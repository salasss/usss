use axum::Json;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Health {
    status: &'static str,
    service: &'static str,
    version: &'static str,
}

/// `GET /health`: liveness probe used by the hosting platform and the app.
pub async fn health() -> Json<Health> {
    Json(Health {
        status: "ok",
        service: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    })
}
