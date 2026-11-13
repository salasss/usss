//! Push notifications through Firebase Cloud Messaging (HTTP v1 API).
//!
//! Push is optional: without `FCM_SERVICE_ACCOUNT`, messages only travel
//! through `/ws`, as before.

mod fcm;
mod payload;

pub use fcm::{DEFAULT_API_URL, Fcm, SendError, ServiceAccount};
pub use payload::{Notification, preview};
