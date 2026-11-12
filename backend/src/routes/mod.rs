mod health;

use axum::{Router, routing::get};
use tower_http::trace::TraceLayer;

use crate::state::AppState;

/// Builds the complete HTTP router of the API.
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
