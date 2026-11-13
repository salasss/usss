#![allow(dead_code)]

use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Router,
    body::Body,
    http::{Request, Response},
};
use http_body_util::BodyExt;
use jsonwebtoken::{EncodingKey, Header, encode};
use serde_json::{Value, json};
use tower::ServiceExt;
use usss_backend::{AppState, config::Config, router};

/// HS256 secret used by the tests (never a real project secret).
pub const TEST_SECRET: &str = "test-secret-that-is-long-enough-for-hs256";

/// The pool is lazy: tests that never query the database need no server.
const UNUSED_DATABASE: &str = "postgres://postgres:postgres@127.0.0.1:1/unused";

pub fn test_config() -> Config {
    Config {
        addr: "127.0.0.1:0".parse().unwrap(),
        supabase_url: None,
        supabase_jwt_secret: Some(TEST_SECRET.to_owned()),
        database_url: UNUSED_DATABASE.to_owned(),
        fcm_service_account: None,
        fcm_api_url: usss_backend::push::DEFAULT_API_URL.to_owned(),
    }
}

pub fn test_app() -> Router {
    router(AppState::new(test_config()).expect("app state"))
}

/// Database for integration tests: a Supabase Postgres with the migrations
/// applied, given by `TEST_DATABASE_URL`. Tests are skipped without it.
pub fn test_database_url() -> Option<String> {
    std::env::var("TEST_DATABASE_URL")
        .ok()
        .filter(|url| !url.is_empty())
}

pub fn db_app(database_url: &str) -> Router {
    let config = Config {
        database_url: database_url.to_owned(),
        ..test_config()
    };
    router(AppState::new(config).expect("app state"))
}

pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Claims of a valid Supabase access token for `user_id`.
pub fn user_claims(user_id: &str) -> Value {
    json!({
        "sub": user_id,
        "aud": "authenticated",
        "role": "authenticated",
        "email": "lea@example.com",
        "exp": now() + 3600,
        "iat": now(),
    })
}

pub fn sign_hs256(claims: &Value, secret: &str) -> String {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("sign token")
}

pub fn bearer(token: &str) -> String {
    format!("Bearer {token}")
}

pub async fn send(app: Router, request: Request<Body>) -> Response<Body> {
    app.oneshot(request).await.expect("request failed")
}

pub async fn json_body(response: Response<Body>) -> Value {
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("JSON body")
}
