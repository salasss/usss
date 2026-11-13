use axum::{Json, extract::State, http::StatusCode};
use serde::Deserialize;

use crate::{auth::AuthUser, error::ApiError, push, state::AppState};

/// FCM registration tokens are about 160 characters; far longer is not one.
const MAX_TOKEN_LEN: usize = 4096;

#[derive(Debug, Deserialize)]
pub struct DeviceRequest {
    token: String,
}

/// `POST /devices` `{ "token": "<FCM registration token>" }`: this phone gets
/// the caller's notifications (taken over from whoever signed in on it before).
pub async fn register(
    State(state): State<AppState>,
    user: AuthUser,
    Json(request): Json<DeviceRequest>,
) -> Result<StatusCode, ApiError> {
    let token = valid_token(&request.token)?;
    push::store::register(&state.db, user.id, token)
        .await
        .map_err(query_failed)?;
    tracing::debug!(user = %user.id, "push token registered");
    Ok(StatusCode::NO_CONTENT)
}

/// `DELETE /devices` `{ "token": "..." }`: no more notifications for the
/// caller on this phone (sign-out). Someone else's token is left alone.
pub async fn unregister(
    State(state): State<AppState>,
    user: AuthUser,
    Json(request): Json<DeviceRequest>,
) -> Result<StatusCode, ApiError> {
    let token = valid_token(&request.token)?;
    push::store::unregister(&state.db, user.id, token)
        .await
        .map_err(query_failed)?;
    Ok(StatusCode::NO_CONTENT)
}

fn valid_token(token: &str) -> Result<&str, ApiError> {
    let token = token.trim();
    let valid = !token.is_empty()
        && token.len() <= MAX_TOKEN_LEN
        && token.bytes().all(|byte| byte.is_ascii_graphic());
    if valid {
        Ok(token)
    } else {
        Err(ApiError::bad_request(
            "a push token has 1 to 4096 printable ASCII characters",
        ))
    }
}

fn query_failed(err: sqlx::Error) -> ApiError {
    tracing::error!(error = %err, "push token query failed");
    ApiError::internal()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_are_validated() {
        let fcm_like = "dGVzdA:APA91bHun4MxP5egoKMwt2KZFBaFUH-1RYqx";
        assert_eq!(valid_token(fcm_like).unwrap(), fcm_like);
        assert_eq!(valid_token(" abc \n").unwrap(), "abc");
        assert!(valid_token("").is_err());
        assert!(valid_token("   ").is_err());
        assert!(valid_token("two words").is_err());
        assert!(valid_token("jeton-é").is_err());
        assert!(valid_token(&"a".repeat(MAX_TOKEN_LEN)).is_ok());
        assert!(valid_token(&"a".repeat(MAX_TOKEN_LEN + 1)).is_err());
    }
}
