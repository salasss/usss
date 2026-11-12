use axum::{Json, extract::State, http::StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{auth::AuthUser, couple, error::ApiError, state::AppState};

/// `GET /couple`: the caller's couple, or `{ "couple": null }` when single.
pub async fn show(State(state): State<AppState>, user: AuthUser) -> Result<Json<Value>, ApiError> {
    let view = couple::couple_of(&state.db, user.id)
        .await
        .map_err(couple::CoupleError::from)?;
    Ok(Json(json!({ "couple": view })))
}

/// `POST /couple`: creates a couple and returns its invite code.
pub async fn create(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<(StatusCode, Json<Value>), ApiError> {
    let view = couple::create(&state.db, user.id).await?;
    tracing::info!(couple = %view.id, "couple created");
    Ok((StatusCode::CREATED, Json(json!({ "couple": view }))))
}

/// `POST /couple/invite`: a new invite code while waiting for the partner.
pub async fn renew_invite(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<Value>, ApiError> {
    let view = couple::renew_invite(&state.db, user.id).await?;
    Ok(Json(json!({ "couple": view })))
}

#[derive(Debug, Deserialize)]
pub struct JoinRequest {
    code: String,
}

/// `POST /couple/join` `{ "code": "K7PQ-2MXZ" }`: joins the partner's couple.
pub async fn join(
    State(state): State<AppState>,
    user: AuthUser,
    Json(request): Json<JoinRequest>,
) -> Result<Json<Value>, ApiError> {
    let view = couple::join(&state.db, user.id, &request.code).await?;
    tracing::info!(couple = %view.id, "partner joined");
    Ok(Json(json!({ "couple": view })))
}
