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

pub fn test_config() -> Config {
    Config {
        addr: "127.0.0.1:0".parse().unwrap(),
        supabase_url: None,
        supabase_jwt_secret: Some(TEST_SECRET.to_owned()),
    }
}

pub fn test_app() -> Router {
    router(AppState::new(test_config()).expect("app state"))
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
