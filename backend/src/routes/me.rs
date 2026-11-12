use axum::Json;

use crate::auth::AuthUser;

/// `GET /me`: the signed-in user, as seen by the backend.
pub async fn me(user: AuthUser) -> Json<AuthUser> {
    Json(user)
}
