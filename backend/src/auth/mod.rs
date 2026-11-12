//! Authentication of the requests sent by the Android app.
//!
//! The app signs in with Google through Supabase Auth and sends the Supabase
//! access token as `Authorization: Bearer <jwt>`. WebSocket upgrades may also
//! pass it as `?access_token=` since some clients cannot set headers there.

mod jwt;

use axum::{
    extract::{FromRequestParts, Request, State},
    http::{HeaderMap, header, request::Parts},
    middleware::Next,
    response::Response,
};
use serde::Serialize;
use uuid::Uuid;

pub use jwt::{JwtVerifier, VerifyError};

use crate::{error::ApiError, state::AppState};

/// The signed-in user behind a request.
#[derive(Clone, Debug, Serialize)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: Option<String>,
}

/// Middleware rejecting requests without a valid Supabase access token.
pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let token = bearer_token(request.headers())
        .or_else(|| websocket_query_token(&request))
        .ok_or_else(|| ApiError::unauthorized("missing access token"))?;

    let user = state.auth.verify(&token).await.map_err(|err| {
        tracing::debug!(error = %err, "access token rejected");
        ApiError::unauthorized("invalid or expired access token")
    })?;

    request.extensions_mut().insert(user);
    Ok(next.run(request).await)
}

impl<S: Send + Sync> FromRequestParts<S> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or_else(|| ApiError::unauthorized("missing access token"))
    }
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let (scheme, token) = value.split_once(' ')?;
    let token = token.trim();
    (scheme.eq_ignore_ascii_case("bearer") && !token.is_empty()).then(|| token.to_owned())
}

fn websocket_query_token(request: &Request) -> Option<String> {
    let is_upgrade = request
        .headers()
        .get(header::UPGRADE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.eq_ignore_ascii_case("websocket"));
    if !is_upgrade {
        return None;
    }

    request.uri().query()?.split('&').find_map(|pair| {
        let (key, value) = pair.split_once('=')?;
        (key == "access_token" && !value.is_empty()).then(|| value.to_owned())
    })
}
