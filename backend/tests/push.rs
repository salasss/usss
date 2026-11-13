//! Push notifications against a real server and database (`TEST_DATABASE_URL`)
//! and a fake Firebase on a local port: OAuth token endpoint and FCM HTTP v1.
mod common;

use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, LazyLock, Mutex},
    time::Duration,
};

use axum::{
    Form, Json, Router,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, Method, Request, StatusCode, header},
    routing::post,
};
use common::{TEST_SECRET, bearer, sign_hs256, test_config, test_database_url, user_claims};
use futures_util::{SinkExt, StreamExt};
use rsa::{
    RsaPrivateKey,
    pkcs8::{EncodePrivateKey, LineEnding},
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async,
    tungstenite::{Message, client::IntoClientRequest},
};
use usss_backend::{AppState, config::Config, push::ServiceAccount, router};
use uuid::Uuid;

type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;

macro_rules! require_db {
    () => {
        match test_database_url() {
            Some(url) => url,
            None => {
                eprintln!("TEST_DATABASE_URL is not set: skipping");
                return;
            }
        }
    };
}

const PROJECT: &str = "usss-test";
const ACCESS_TOKEN: &str = "fake-access-token";
/// The fake FCM answers UNREGISTERED for this phone, like for an uninstalled app.
const STALE_PHONE: &str = "stale-phone-token";

/// Private key of the fake service account (generated once: RSA is slow).
static PRIVATE_KEY: LazyLock<String> = LazyLock::new(|| {
    RsaPrivateKey::new(&mut rand_core::OsRng, 2048)
        .expect("RSA key")
        .to_pkcs8_pem(LineEnding::LF)
        .expect("PEM")
        .to_string()
});

// ------------------------------------------------------------ fake Firebase --

#[derive(Clone, Default)]
struct Firebase {
    /// Assertions exchanged at the token endpoint.
    assertions: Arc<Mutex<Vec<String>>>,
    /// Bodies received by `messages:send`.
    sent: Arc<Mutex<Vec<Value>>>,
}

async fn fake_firebase() -> (String, Firebase) {
    let firebase = Firebase::default();
    let app = Router::new()
        .route("/token", post(issue_access_token))
        .route(
            "/v1/projects/{project}/messages:send",
            post(receive_message),
        )
        .with_state(firebase.clone());
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (url, firebase)
}

async fn issue_access_token(
    State(firebase): State<Firebase>,
    Form(form): Form<HashMap<String, String>>,
) -> Result<Json<Value>, StatusCode> {
    if form.get("grant_type").map(String::as_str)
        != Some("urn:ietf:params:oauth:grant-type:jwt-bearer")
    {
        return Err(StatusCode::BAD_REQUEST);
    }
    let assertion = form.get("assertion").ok_or(StatusCode::BAD_REQUEST)?;
    firebase.assertions.lock().unwrap().push(assertion.clone());
    Ok(Json(json!({
        "access_token": ACCESS_TOKEN,
        "expires_in": 3599,
        "token_type": "Bearer",
    })))
}

async fn receive_message(
    State(firebase): State<Firebase>,
    Path(project): Path<String>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> (StatusCode, Json<Value>) {
    let authorized = headers
        .get(header::AUTHORIZATION)
        .is_some_and(|value| value == format!("Bearer {ACCESS_TOKEN}").as_str());
    if !authorized || project != PROJECT {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": { "code": 401 } })),
        );
    }

    firebase.sent.lock().unwrap().push(body.clone());
    if body["message"]["token"] == STALE_PHONE {
        let unregistered = json!({
            "error": {
                "code": 404,
                "message": "Requested entity was not found.",
                "status": "NOT_FOUND",
                "details": [{
                    "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
                    "errorCode": "UNREGISTERED",
                }],
            }
        });
        return (StatusCode::NOT_FOUND, Json(unregistered));
    }
    (
        StatusCode::OK,
        Json(json!({ "name": format!("projects/{PROJECT}/messages/1") })),
    )
}

impl Firebase {
    fn sent(&self) -> Vec<Value> {
        self.sent.lock().unwrap().clone()
    }

    /// Waits until FCM has received `count` messages in total.
    async fn wait_for(&self, count: usize) -> Vec<Value> {
        for _ in 0..100 {
            let sent = self.sent();
            if sent.len() >= count {
                return sent;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("FCM received {} message(s), not {count}", self.sent().len());
    }
}

// ------------------------------------------------------------------ server --

struct Person {
    id: Uuid,
    token: String,
}

struct Server {
    addr: SocketAddr,
    pool: PgPool,
    http: reqwest::Client,
}

async fn server(database_url: &str, firebase_url: &str) -> Server {
    let account = json!({
        "type": "service_account",
        "project_id": PROJECT,
        "private_key_id": "test-key",
        "private_key": *PRIVATE_KEY,
        "client_email": format!("push@{PROJECT}.iam.gserviceaccount.com"),
        "token_uri": format!("{firebase_url}/token"),
    });
    let config = Config {
        database_url: database_url.to_owned(),
        fcm_service_account: Some(ServiceAccount::parse(&account.to_string()).unwrap()),
        fcm_api_url: firebase_url.to_owned(),
        ..test_config()
    };
    let app = router(AppState::new(config).unwrap());
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    Server {
        addr,
        pool: PgPool::connect(database_url).await.unwrap(),
        http: reqwest::Client::new(),
    }
}

impl Server {
    async fn person(&self, name: &str) -> Person {
        let id = Uuid::new_v4();
        sqlx::query(
            "insert into auth.users (id, email, raw_user_meta_data)
             values ($1, $2, jsonb_build_object('full_name', $3::text))",
        )
        .bind(id)
        .bind(format!("{id}@example.com"))
        .bind(name)
        .execute(&self.pool)
        .await
        .unwrap();
        Person {
            id,
            token: sign_hs256(&user_claims(&id.to_string()), TEST_SECRET),
        }
    }

    async fn couple(&self, first: &Person, second: &Person) -> Uuid {
        let couple: Uuid =
            sqlx::query_scalar("insert into public.couples (created_by) values ($1) returning id")
                .bind(first.id)
                .fetch_one(&self.pool)
                .await
                .unwrap();
        for (seat, person) in [(1_i16, first), (2, second)] {
            sqlx::query(
                "insert into public.couple_members (couple_id, user_id, seat) values ($1, $2, $3)",
            )
            .bind(couple)
            .bind(person.id)
            .bind(seat)
            .execute(&self.pool)
            .await
            .unwrap();
        }
        couple
    }

    /// `POST` or `DELETE /devices` as `who`.
    async fn device(&self, method: Method, who: &Person, token: &str) -> StatusCode {
        self.http
            .request(method, format!("http://{}/devices", self.addr))
            .bearer_auth(&who.token)
            .json(&json!({ "token": token }))
            .send()
            .await
            .unwrap()
            .status()
    }

    async fn owner_of(&self, token: &str) -> Option<Uuid> {
        sqlx::query_scalar("select user_id from public.push_tokens where token = $1")
            .bind(token)
            .fetch_optional(&self.pool)
            .await
            .unwrap()
    }

    async fn connect(&self, who: &Person) -> Ws {
        let mut request = format!("ws://{}/ws", self.addr)
            .into_client_request()
            .unwrap();
        request
            .headers_mut()
            .insert(header::AUTHORIZATION, bearer(&who.token).parse().unwrap());
        let (mut ws, _) = connect_async(request).await.expect("websocket");
        expect(&mut ws, "ready").await;
        ws
    }
}

/// Next event of type `kind`, skipping the others.
async fn expect(ws: &mut Ws, kind: &str) -> Value {
    for _ in 0..10 {
        let frame = tokio::time::timeout(Duration::from_secs(5), ws.next())
            .await
            .expect("no event within 5 s")
            .expect("connection closed")
            .expect("websocket error");
        if let Message::Text(text) = frame {
            let event: Value = serde_json::from_str(text.as_str()).unwrap();
            if event["type"] == kind {
                return event;
            }
        }
    }
    panic!("no `{kind}` event");
}

/// Sends a message and waits for the server to store and broadcast it.
async fn say(ws: &mut Ws, message: Value) {
    ws.send(Message::Text(message.to_string().into()))
        .await
        .unwrap();
    expect(ws, "message.new").await;
}

fn text(id: Uuid, body: &str) -> Value {
    json!({ "type": "message.send", "id": id, "kind": "text", "body": body })
}

/// Lets a push that should not happen show up before checking it did not.
async fn settle() {
    tokio::time::sleep(Duration::from_millis(500)).await;
}

// ------------------------------------------------------------------- tests --

#[tokio::test]
async fn device_tokens_are_validated() {
    let token = sign_hs256(&user_claims(&Uuid::new_v4().to_string()), TEST_SECRET);
    let request = |authorization: Option<&str>, body: Value| {
        let mut builder =
            Request::post("/devices").header(header::CONTENT_TYPE, "application/json");
        if let Some(value) = authorization {
            builder = builder.header(header::AUTHORIZATION, value);
        }
        builder.body(Body::from(body.to_string())).unwrap()
    };

    let anonymous = common::send(common::test_app(), request(None, json!({ "token": "abc" })));
    assert_eq!(anonymous.await.status(), StatusCode::UNAUTHORIZED);

    for bad in [json!(""), json!("two words"), json!("a".repeat(4097))] {
        let response = common::send(
            common::test_app(),
            request(Some(&bearer(&token)), json!({ "token": bad })),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(common::json_body(response).await["error"], "bad_request");
    }
}

#[tokio::test]
async fn phones_follow_the_account_signed_in_on_them() {
    let (firebase_url, _) = fake_firebase().await;
    let server = server(&require_db!(), &firebase_url).await;
    let lea = server.person("Léa").await;
    let thomas = server.person("Thomas").await;
    let phone = format!("shared-phone-{}", Uuid::new_v4());

    assert_eq!(
        server.device(Method::POST, &lea, &phone).await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(server.owner_of(&phone).await, Some(lea.id));

    // Thomas signs in on the same phone: its notifications are now his.
    assert_eq!(
        server.device(Method::POST, &thomas, &phone).await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(server.owner_of(&phone).await, Some(thomas.id));

    // Léa cannot unregister a phone that is no longer hers.
    assert_eq!(
        server.device(Method::DELETE, &lea, &phone).await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(server.owner_of(&phone).await, Some(thomas.id));

    // Signing out removes it.
    assert_eq!(
        server.device(Method::DELETE, &thomas, &phone).await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(server.owner_of(&phone).await, None);

    // Old registrations (reinstalls) do not pile up.
    let phones: Vec<String> = (0..12)
        .map(|i| format!("phone-{i}-{}", Uuid::new_v4()))
        .collect();
    for phone in &phones {
        assert_eq!(
            server.device(Method::POST, &lea, phone).await,
            StatusCode::NO_CONTENT
        );
    }
    let kept: i64 =
        sqlx::query_scalar("select count(*) from public.push_tokens where user_id = $1")
            .bind(lea.id)
            .fetch_one(&server.pool)
            .await
            .unwrap();
    assert_eq!(kept, 10);
    assert_eq!(
        server.owner_of(&phones[0]).await,
        None,
        "the oldest goes first"
    );
    assert_eq!(server.owner_of(&phones[11]).await, Some(lea.id));
}

#[tokio::test]
async fn the_partner_away_gets_a_notification() {
    let (firebase_url, firebase) = fake_firebase().await;
    let server = server(&require_db!(), &firebase_url).await;
    let lea = server.person("Léa").await;
    let thomas = server.person("Thomas").await;
    let couple = server.couple(&lea, &thomas).await;
    let lea_phone = format!("lea-phone-{}", Uuid::new_v4());
    let thomas_phone = format!("thomas-phone-{}", Uuid::new_v4());
    assert_eq!(
        server.device(Method::POST, &lea, &lea_phone).await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        server.device(Method::POST, &thomas, &thomas_phone).await,
        StatusCode::NO_CONTENT
    );

    // Thomas has the app closed: Léa's message reaches his phone.
    let mut lea_ws = server.connect(&lea).await;
    let message = text(Uuid::new_v4(), "On se voit ce soir ?");
    say(&mut lea_ws, message.clone()).await;
    let sent = firebase.wait_for(1).await;
    assert_eq!(
        sent[0],
        json!({
            "message": {
                "token": thomas_phone,
                "notification": { "title": "Léa", "body": "On se voit ce soir ?" },
                "data": { "type": "message", "couple_id": couple.to_string() },
                "android": { "priority": "HIGH", "notification": { "channel_id": "messages" } },
            }
        })
    );

    // A resend after a reconnection is not notified twice.
    say(&mut lea_ws, message).await;
    settle().await;
    assert_eq!(firebase.sent().len(), 1);

    // A voice note says what it is; the access token is reused.
    let voice = json!({
        "type": "message.send", "id": Uuid::new_v4(), "kind": "voice",
        "media_path": format!("{couple}/voice/1.m4a"), "duration_ms": 4000,
    });
    say(&mut lea_ws, voice).await;
    let sent = firebase.wait_for(2).await;
    assert_eq!(
        sent[1]["message"]["notification"]["body"],
        "🎤 Message vocal"
    );
    assert_eq!(firebase.assertions.lock().unwrap().len(), 1);

    // Thomas opens the app: the message shows there, no notification.
    let mut thomas_ws = server.connect(&thomas).await;
    say(&mut lea_ws, text(Uuid::new_v4(), "Tu es là !")).await;
    expect(&mut thomas_ws, "message.new").await;
    settle().await;
    assert_eq!(firebase.sent().len(), 2);

    // Léa's phone is never notified of her own messages.
    assert!(
        firebase
            .sent()
            .iter()
            .all(|body| body["message"]["token"] == thomas_phone.as_str())
    );
}

#[tokio::test]
async fn phones_fcm_no_longer_knows_are_forgotten() {
    let (firebase_url, firebase) = fake_firebase().await;
    let server = server(&require_db!(), &firebase_url).await;
    let lea = server.person("Léa").await;
    let thomas = server.person("Thomas").await;
    server.couple(&lea, &thomas).await;
    let new_phone = format!("new-phone-{}", Uuid::new_v4());
    assert_eq!(
        server.device(Method::POST, &thomas, STALE_PHONE).await,
        StatusCode::NO_CONTENT
    );
    assert_eq!(
        server.device(Method::POST, &thomas, &new_phone).await,
        StatusCode::NO_CONTENT
    );

    let mut lea_ws = server.connect(&lea).await;
    say(&mut lea_ws, text(Uuid::new_v4(), "Coucou")).await;
    firebase.wait_for(2).await;

    for _ in 0..100 {
        if server.owner_of(STALE_PHONE).await.is_none() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert_eq!(
        server.owner_of(STALE_PHONE).await,
        None,
        "UNREGISTERED token removed"
    );
    assert_eq!(server.owner_of(&new_phone).await, Some(thomas.id));
}
