use axum::{
    extract::{State, WebSocketUpgrade},
    http::StatusCode,
    response::Response,
};

use crate::{auth::AuthUser, error::ApiError, realtime, state::AppState};

/// Largest frame accepted from the phone (media go through Storage).
const MAX_FRAME_BYTES: usize = 64 * 1024;

/// `GET /ws`: opens the realtime channel of the caller's couple.
pub async fn connect(
    State(state): State<AppState>,
    user: AuthUser,
    upgrade: WebSocketUpgrade,
) -> Result<Response, ApiError> {
    let couple = realtime::store::couple_of(&state.db, user.id)
        .await
        .map_err(|err| {
            tracing::error!(error = %err, "couple lookup failed");
            ApiError::internal()
        })?
        .ok_or_else(|| {
            ApiError::new(
                StatusCode::NOT_FOUND,
                "not_paired",
                "join your partner before opening the bubble",
            )
        })?;

    Ok(upgrade
        .max_message_size(MAX_FRAME_BYTES)
        .on_upgrade(move |socket| realtime::session::run(socket, state, user, couple)))
}
