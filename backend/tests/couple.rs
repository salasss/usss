//! Pairing scenarios against a real Supabase Postgres (`TEST_DATABASE_URL`)
//! with the migrations of `supabase/migrations` applied.
mod common;

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode, header},
};
use common::{
    TEST_SECRET, bearer, db_app, json_body, send, sign_hs256, test_database_url, user_claims,
};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

/// Skips the test when no database is configured.
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
    token: String,
}

struct Env {
    app: Router,
    pool: PgPool,
}

async fn env(url: &str) -> Env {
    Env {
        app: db_app(url),
        pool: PgPool::connect(url).await.expect("test database"),
    }
}

impl Env {
    /// A new Google account (the auth trigger creates its profile).
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
        .expect("insert user");

        Person {
            token: sign_hs256(&user_claims(&id.to_string()), TEST_SECRET),
        }
    }

    async fn call(
        &self,
        method: &str,
        uri: &str,
        who: &Person,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let builder = Request::builder()
            .method(method)
            .uri(uri)
            .header(header::AUTHORIZATION, bearer(&who.token));
        let request = match body {
            Some(body) => builder
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.to_string())),
            None => builder.body(Body::empty()),
        }
        .unwrap();

        let response = send(self.app.clone(), request).await;
        let status = response.status();
        (status, json_body(response).await)
    }

    async fn create(&self, who: &Person) -> Value {
        let (status, body) = self.call("POST", "/couple", who, None).await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        body["couple"].clone()
    }

    async fn join(&self, who: &Person, code: &str) -> (StatusCode, Value) {
        self.call("POST", "/couple/join", who, Some(json!({ "code": code })))
            .await
    }

    async fn members(&self, couple_id: &str) -> i64 {
        sqlx::query_scalar("select count(*) from public.couple_members where couple_id = $1::uuid")
            .bind(couple_id)
            .fetch_one(&self.pool)
            .await
            .unwrap()
    }
}

fn invite_code(couple: &Value) -> String {
    couple["invite"]["code"]
        .as_str()
        .expect("invite code")
        .to_owned()
}

#[tokio::test]
async fn creating_a_couple_gives_an_invite_code() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;

    let couple = env.create(&lea).await;

    let code = invite_code(&couple);
    assert_eq!(code.len(), 8);
    assert!(
        code.chars()
            .all(|c| "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".contains(c))
    );
    assert_eq!(couple["complete"], false);
    assert_eq!(couple["invite"]["expired"], false);
    assert_eq!(couple["members"][0]["display_name"], "Léa");
    assert_eq!(couple["members"][0]["seat"], 1);
}

#[tokio::test]
async fn creating_twice_is_refused() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;
    env.create(&lea).await;

    let (status, body) = env.call("POST", "/couple", &lea, None).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "already_paired");
}

#[tokio::test]
async fn partner_joins_with_the_code() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;
    let thomas = env.person("Thomas").await;
    let code = invite_code(&env.create(&lea).await);

    // Typed loosely on the phone.
    let typed = format!("{}-{}", &code[..4], &code[4..]).to_lowercase();
    let (status, body) = env.join(&thomas, &typed).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    let couple = &body["couple"];
    assert_eq!(couple["complete"], true);
    assert_eq!(couple["invite"], Value::Null, "the code is consumed");
    assert_eq!(couple["members"][0]["display_name"], "Léa");
    assert_eq!(couple["members"][1]["display_name"], "Thomas");
    assert_eq!(couple["members"][1]["seat"], 2);

    let (_, seen_by_lea) = env.call("GET", "/couple", &lea, None).await;
    assert_eq!(seen_by_lea["couple"]["id"], couple["id"]);
    assert_eq!(seen_by_lea["couple"]["complete"], true);
}

#[tokio::test]
async fn a_used_code_lets_nobody_else_in() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;
    let thomas = env.person("Thomas").await;
    let intruder = env.person("Intrus").await;
    let couple = env.create(&lea).await;
    let code = invite_code(&couple);
    env.join(&thomas, &code).await;

    let (status, body) = env.join(&intruder, &code).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "invite_not_found");
    assert_eq!(env.members(couple["id"].as_str().unwrap()).await, 2);
}

#[tokio::test]
async fn simultaneous_joins_admit_a_single_partner() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;
    let couple = env.create(&lea).await;
    let code = invite_code(&couple);

    let mut people = Vec::new();
    for name in ["Thomas", "Sam", "Alex", "Charlie"] {
        people.push(env.person(name).await);
    }
    let attempts = people.iter().map(|who| env.join(who, &code));
    let results = futures_util::future::join_all(attempts).await;

    let admitted = results
        .iter()
        .filter(|(status, _)| *status == StatusCode::OK)
        .count();
    assert_eq!(admitted, 1, "{results:?}");
    assert_eq!(env.members(couple["id"].as_str().unwrap()).await, 2);
}

#[tokio::test]
async fn expired_code_is_refused() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;
    let thomas = env.person("Thomas").await;
    let couple = env.create(&lea).await;
    sqlx::query(
        "update public.couples set invite_expires_at = now() - interval '1 minute' where id = $1::uuid",
    )
    .bind(couple["id"].as_str().unwrap())
    .execute(&env.pool)
    .await
    .unwrap();

    let (status, body) = env.join(&thomas, &invite_code(&couple)).await;
    assert_eq!(status, StatusCode::GONE);
    assert_eq!(body["error"], "invite_expired");
}

#[tokio::test]
async fn malformed_and_unknown_codes_are_refused() {
    let env = env(&require_db!()).await;
    let thomas = env.person("Thomas").await;

    let (status, _) = env.join(&thomas, "ABC").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let (status, body) = env.join(&thomas, "ZZZZ2222").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "invite_not_found");
}

#[tokio::test]
async fn renewing_the_invite_replaces_the_code() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;
    let thomas = env.person("Thomas").await;
    let old_code = invite_code(&env.create(&lea).await);

    let (status, body) = env.call("POST", "/couple/invite", &lea, None).await;
    assert_eq!(status, StatusCode::OK);
    let new_code = invite_code(&body["couple"]);
    assert_ne!(new_code, old_code);

    let (status, _) = env.join(&thomas, &old_code).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "the old code is gone");
    let (status, _) = env.join(&thomas, &new_code).await;
    assert_eq!(status, StatusCode::OK);

    let (status, body) = env.call("POST", "/couple/invite", &lea, None).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "couple_complete");
}

#[tokio::test]
async fn a_single_person_has_no_couple() {
    let env = env(&require_db!()).await;
    let solo = env.person("Solo").await;

    let (status, body) = env.call("GET", "/couple", &solo, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["couple"], Value::Null);

    let (status, body) = env.call("POST", "/couple/invite", &solo, None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "not_paired");
}

#[tokio::test]
async fn both_created_a_couple_and_one_joins_the_other() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;
    let thomas = env.person("Thomas").await;
    let leas = env.create(&lea).await;
    let thomass = env.create(&thomas).await;

    let (status, body) = env.join(&thomas, &invite_code(&leas)).await;

    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["couple"]["id"], leas["id"]);
    assert_eq!(
        env.members(thomass["id"].as_str().unwrap()).await,
        0,
        "empty couple removed"
    );
}

#[tokio::test]
async fn someone_paired_cannot_join_another_couple() {
    let env = env(&require_db!()).await;
    let lea = env.person("Léa").await;
    let thomas = env.person("Thomas").await;
    let sam = env.person("Sam").await;
    let code = invite_code(&env.create(&lea).await);
    env.join(&thomas, &code).await;
    let sams = env.create(&sam).await;

    let (status, body) = env.join(&thomas, &invite_code(&sams)).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "already_paired");
}
