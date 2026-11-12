//! Two phones talking through `/ws`, against a real server and database
//! (`TEST_DATABASE_URL`, Supabase Postgres with the migrations applied).
mod common;

use std::{net::SocketAddr, time::Duration};

use axum::http::{HeaderValue, StatusCode, header::AUTHORIZATION};
use common::{TEST_SECRET, bearer, sign_hs256, test_config, test_database_url, user_claims};
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use sqlx::PgPool;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async,
    tungstenite::{self, Message, client::IntoClientRequest},
};
use usss_backend::{AppState, config::Config, router};
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

struct Person {
    id: Uuid,
    token: String,
}

struct Server {
    addr: SocketAddr,
    pool: PgPool,
}

async fn server(url: &str) -> Server {
    let config = Config {
        database_url: url.to_owned(),
        ..test_config()
    };
    let app = router(AppState::new(config).unwrap());
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    Server {
        addr,
        pool: PgPool::connect(url).await.unwrap(),
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

    /// A complete couple, set up directly in the database.
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

    async fn connect(&self, who: &Person) -> Ws {
        self.try_connect(Some(&who.token), "")
            .await
            .expect("websocket")
    }

    async fn try_connect(
        &self,
        token: Option<&str>,
        query: &str,
    ) -> Result<Ws, tungstenite::Error> {
        let mut request = format!("ws://{}/ws{query}", self.addr)
            .into_client_request()
            .unwrap();
        if let Some(token) = token {
            request.headers_mut().insert(
                AUTHORIZATION,
                HeaderValue::from_str(&bearer(token)).unwrap(),
            );
        }
        connect_async(request).await.map(|(ws, _)| ws)
    }
}

async fn next_event(ws: &mut Ws) -> Value {
    loop {
        let frame = tokio::time::timeout(Duration::from_secs(5), ws.next())
            .await
            .expect("no event within 5 s")
            .expect("connection closed")
            .expect("websocket error");
        if let Message::Text(text) = frame {
            return serde_json::from_str(text.as_str()).unwrap();
        }
    }
}

/// Next event of type `kind`, skipping the others.
async fn expect(ws: &mut Ws, kind: &str) -> Value {
    for _ in 0..10 {
        let event = next_event(ws).await;
        if event["type"] == kind {
            return event;
        }
    }
    panic!("no `{kind}` event");
}

async fn assert_silent(ws: &mut Ws) {
    let quiet = tokio::time::timeout(Duration::from_millis(400), async {
        loop {
            match ws.next().await {
                Some(Ok(Message::Text(text))) => return text.to_string(),
                Some(Ok(_)) => continue,
                _ => return String::new(),
            }
        }
    })
    .await;
    assert!(quiet.is_err(), "unexpected event: {quiet:?}");
}

async fn send(ws: &mut Ws, event: Value) {
    ws.send(Message::Text(event.to_string().into()))
        .await
        .unwrap();
}

#[tokio::test]
async fn partners_share_messages_moods_and_presence_in_real_time() {
    let server = server(&require_db!()).await;
    let lea = server.person("Léa").await;
    let thomas = server.person("Thomas").await;
    let couple = server.couple(&lea, &thomas).await;

    let mut lea_ws = server.connect(&lea).await;
    let ready = expect(&mut lea_ws, "ready").await;
    assert_eq!(ready["couple_id"], couple.to_string());
    assert_eq!(ready["partner_online"], false);

    let mut thomas_ws = server.connect(&thomas).await;
    assert_eq!(
        expect(&mut thomas_ws, "ready").await["partner_online"],
        true
    );
    let presence = expect(&mut lea_ws, "presence").await;
    assert_eq!(presence["user_id"], thomas.id.to_string());
    assert_eq!(presence["online"], true);

    // A message reaches both phones and is stored once, even when resent.
    let message_id = Uuid::new_v4();
    let message = json!({ "type": "message.send", "id": message_id, "kind": "text", "body": "On se fait quoi ce soir ?" });
    send(&mut lea_ws, message.clone()).await;
    for ws in [&mut lea_ws, &mut thomas_ws] {
        let event = expect(ws, "message.new").await;
        assert_eq!(event["message"]["id"], message_id.to_string());
        assert_eq!(event["message"]["sender_id"], lea.id.to_string());
        assert_eq!(event["message"]["body"], "On se fait quoi ce soir ?");
    }
    send(&mut lea_ws, message).await;
    expect(&mut thomas_ws, "message.new").await;
    let stored: i64 = sqlx::query_scalar("select count(*) from public.messages where id = $1")
        .bind(message_id)
        .fetch_one(&server.pool)
        .await
        .unwrap();
    assert_eq!(stored, 1);

    // Typing is relayed to the partner only.
    send(&mut thomas_ws, json!({ "type": "typing", "active": true })).await;
    let typing = expect(&mut lea_ws, "typing").await;
    assert_eq!(typing["user_id"], thomas.id.to_string());
    assert_silent(&mut thomas_ws).await;

    // Reactions, read receipts and moods.
    send(
        &mut thomas_ws,
        json!({ "type": "reaction.set", "message_id": message_id, "emoji": "❤️" }),
    )
    .await;
    assert_eq!(expect(&mut lea_ws, "reaction").await["emoji"], "❤️");
    expect(&mut thomas_ws, "reaction").await;

    send(
        &mut thomas_ws,
        json!({ "type": "message.read", "until": chrono::Utc::now() }),
    )
    .await;
    assert_eq!(
        expect(&mut lea_ws, "message.read").await["reader_id"],
        thomas.id.to_string()
    );
    let read: bool =
        sqlx::query_scalar("select read_at is not null from public.messages where id = $1")
            .bind(message_id)
            .fetch_one(&server.pool)
            .await
            .unwrap();
    assert!(read);

    send(
        &mut lea_ws,
        json!({ "type": "mood.set", "energy": 80, "mood": 65 }),
    )
    .await;
    let mood = expect(&mut thomas_ws, "mood").await;
    assert_eq!(mood["mood"]["user_id"], lea.id.to_string());
    assert_eq!(mood["mood"]["energy"], 80);

    // Leaving shows the partner offline.
    thomas_ws.close(None).await.unwrap();
    let presence = expect(&mut lea_ws, "presence").await;
    assert_eq!(presence["online"], false);
}

#[tokio::test]
async fn other_couples_hear_nothing() {
    let server = server(&require_db!()).await;
    let (lea, thomas) = (server.person("Léa").await, server.person("Thomas").await);
    let (sam, alex) = (server.person("Sam").await, server.person("Alex").await);
    server.couple(&lea, &thomas).await;
    server.couple(&sam, &alex).await;

    let mut lea_ws = server.connect(&lea).await;
    expect(&mut lea_ws, "ready").await;
    let mut sam_ws = server.connect(&sam).await;
    expect(&mut sam_ws, "ready").await;

    send(
        &mut lea_ws,
        json!({ "type": "message.send", "id": Uuid::new_v4(), "kind": "text", "body": "Secret" }),
    )
    .await;
    expect(&mut lea_ws, "message.new").await;
    assert_silent(&mut sam_ws).await;
}

#[tokio::test]
async fn invalid_frames_get_an_error_reply() {
    let server = server(&require_db!()).await;
    let (lea, thomas) = (server.person("Léa").await, server.person("Thomas").await);
    server.couple(&lea, &thomas).await;
    let mut ws = server.connect(&lea).await;
    expect(&mut ws, "ready").await;

    ws.send(Message::Text("not json".into())).await.unwrap();
    assert_eq!(expect(&mut ws, "error").await["code"], "bad_frame");

    let elsewhere = format!("{}/spy.jpg", Uuid::new_v4());
    send(&mut ws, json!({ "type": "message.send", "id": Uuid::new_v4(), "kind": "image", "media_path": elsewhere })).await;
    assert_eq!(expect(&mut ws, "error").await["code"], "invalid_message");

    send(
        &mut ws,
        json!({ "type": "mood.set", "energy": 300, "mood": 50 }),
    )
    .await;
    assert_eq!(expect(&mut ws, "error").await["code"], "invalid_mood");

    send(&mut ws, json!({ "type": "ping" })).await;
    expect(&mut ws, "pong").await;
}

#[tokio::test]
async fn the_bubble_needs_a_signed_in_partner() {
    let server = server(&require_db!()).await;
    let solo = server.person("Solo").await;

    match server.try_connect(None, "").await {
        Err(tungstenite::Error::Http(response)) => {
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED)
        }
        other => panic!("expected 401, got {other:?}"),
    }
    match server.try_connect(Some(&solo.token), "").await {
        Err(tungstenite::Error::Http(response)) => {
            assert_eq!(response.status(), StatusCode::NOT_FOUND)
        }
        other => panic!("expected 404 for someone unpaired, got {other:?}"),
    }
}

#[tokio::test]
async fn websocket_token_can_travel_in_the_query_string() {
    let server = server(&require_db!()).await;
    let (lea, thomas) = (server.person("Léa").await, server.person("Thomas").await);
    server.couple(&lea, &thomas).await;

    let mut ws = server
        .try_connect(None, &format!("?access_token={}", lea.token))
        .await
        .expect("websocket");
    expect(&mut ws, "ready").await;
}
