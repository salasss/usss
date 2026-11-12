//! Pairing of two people into a couple.
//!
//! One partner creates the couple and gets an invite code, the other joins
//! with it. A couple never has more than two members: the join runs in a
//! transaction that locks the couple, and the database constraints (two
//! seats per couple, one couple per person) remain the last line of defence.

pub mod code;
mod store;

use axum::http::StatusCode;
use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use uuid::Uuid;

pub use store::{couple_of, create, join, renew_invite};

use crate::error::ApiError;

/// How long an invite code stays valid.
pub const INVITE_TTL_HOURS: i32 = 48;

#[derive(Debug, Serialize)]
pub struct CoupleView {
    pub id: Uuid,
    /// Both seats are taken.
    pub complete: bool,
    pub invite: Option<Invite>,
    pub together_since: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub members: Vec<Member>,
}

#[derive(Debug, Serialize)]
pub struct Invite {
    pub code: String,
    pub expires_at: DateTime<Utc>,
    pub expired: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Member {
    pub user_id: Uuid,
    pub seat: i16,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum CoupleError {
    #[error("already in a couple")]
    AlreadyPaired,
    #[error("not in a couple")]
    NotPaired,
    #[error("malformed invite code")]
    MalformedCode,
    #[error("unknown invite code")]
    InviteNotFound,
    #[error("expired invite code")]
    InviteExpired,
    #[error("the couple already has two members")]
    CoupleComplete,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

impl From<CoupleError> for ApiError {
    fn from(err: CoupleError) -> Self {
        match err {
            CoupleError::AlreadyPaired => {
                ApiError::conflict("already_paired", "you are already part of a couple")
            }
            CoupleError::NotPaired => ApiError::new(
                StatusCode::NOT_FOUND,
                "not_paired",
                "you are not part of a couple yet",
            ),
            CoupleError::MalformedCode => {
                ApiError::bad_request("an invite code has 8 letters or digits")
            }
            CoupleError::InviteNotFound => ApiError::new(
                StatusCode::NOT_FOUND,
                "invite_not_found",
                "no couple uses this invite code",
            ),
            CoupleError::InviteExpired => ApiError::new(
                StatusCode::GONE,
                "invite_expired",
                "this invite code has expired, ask for a new one",
            ),
            CoupleError::CoupleComplete => {
                ApiError::conflict("couple_complete", "this couple already has two members")
            }
            CoupleError::Database(err) => {
                tracing::error!(error = %err, "couple query failed");
                ApiError::internal()
            }
        }
    }
}
