mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};

#[tokio::test]
async fn health_reports_ok() {
    let response = common::send(
        common::test_app(),
        Request::get("/health").body(Body::empty()).unwrap(),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);
    let body = common::json_body(response).await;
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "usss-backend");
}

#[tokio::test]
async fn unknown_route_is_not_found() {
    let response = common::send(
        common::test_app(),
        Request::get("/nope").body(Body::empty()).unwrap(),
    )
    .await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
