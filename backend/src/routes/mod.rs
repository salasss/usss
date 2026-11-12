mod health;
mod me;

use axum::{Router, extract::Request, middleware, routing::get};
use tower_http::trace::TraceLayer;

use crate::{auth::require_auth, state::AppState};

/// Builds the complete HTTP router of the API.
pub fn router(state: AppState) -> Router {
    let protected = Router::new()
        .route("/me", get(me::me))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/health", get(health::health))
        .merge(protected)
        .layer(
            // Log the path only: query strings may carry an access token.
            TraceLayer::new_for_http().make_span_with(|request: &Request| {
                tracing::info_span!(
                    "request",
                    method = %request.method(),
                    path = %request.uri().path(),
                )
            }),
        )
        .with_state(state)
}
