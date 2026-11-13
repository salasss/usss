//! Push notifications through Firebase Cloud Messaging (HTTP v1 API).
//!
//! The app registers the FCM token of each phone with `POST /devices`. When
//! a new message is sent while the partner has no open realtime connection
//! (app closed or in the background), each of their phones is notified.
//! Push is optional: without `FCM_SERVICE_ACCOUNT`, messages only travel
//! through `/ws`, as before.

mod fcm;
mod payload;
pub mod store;

use sqlx::PgPool;
use uuid::Uuid;

pub use fcm::{DEFAULT_API_URL, Fcm, SendError, ServiceAccount};
pub use payload::{Notification, preview};

use crate::{
    realtime::{Hub, protocol::MessageRow},
    state::AppState,
};

/// Notifies the partner of a message `sender` just sent, if they are away.
/// Runs in its own task: the sender's connection never waits for FCM.
pub fn notify_partner(state: &AppState, couple: Uuid, sender: Uuid, message: &MessageRow) {
    let Some(fcm) = state.push.clone() else {
        return;
    };
    let db = state.db.clone();
    let hub = state.hub.clone();
    let preview = preview(message.kind, message.body.as_deref());

    tokio::spawn(async move {
        if let Err(err) = deliver(&fcm, &db, &hub, couple, sender, preview).await {
            tracing::warn!(error = %err, %couple, "push notification query failed");
        }
    });
}

async fn deliver(
    fcm: &Fcm,
    db: &PgPool,
    hub: &Hub,
    couple: Uuid,
    sender: Uuid,
    preview: String,
) -> Result<(), sqlx::Error> {
    let Some((partner, sender_name)) = store::recipient(db, couple, sender).await? else {
        return Ok(());
    };
    // An open connection already shows the message in the app.
    if hub.is_online(couple, partner) {
        return Ok(());
    }

    let tokens = store::tokens_of(db, partner).await?;
    if tokens.is_empty() {
        return Ok(());
    }
    let notification = Notification::new(&sender_name, preview);
    for token in tokens {
        match fcm.send(&token, &notification, couple).await {
            Ok(()) => tracing::debug!(user = %partner, "push notification sent"),
            Err(SendError::InvalidToken) => {
                store::forget(db, &token).await?;
                tracing::info!(user = %partner, "forgot a push token FCM no longer accepts");
            }
            Err(err) => tracing::warn!(error = %err, user = %partner, "push notification not sent"),
        }
    }
    Ok(())
}
