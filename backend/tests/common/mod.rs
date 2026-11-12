#![allow(dead_code)]

use axum::{
    Router,
    body::Body,
    http::{Request, Response},
};
use http_body_util::BodyExt;
use tower::ServiceExt;
use usss_backend::{AppState, config::Config, router};

pub fn test_config() -> Config {
    Config {
        addr: "127.0.0.1:0".parse().unwrap(),
    }
}

pub fn test_app() -> Router {
    router(AppState::new(test_config()))
}

pub async fn send(app: Router, request: Request<Body>) -> Response<Body> {
    app.oneshot(request).await.expect("request failed")
}

pub async fn json_body(response: Response<Body>) -> serde_json::Value {
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("JSON body")
}
