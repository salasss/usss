use std::sync::Arc;

use anyhow::Context;
use sqlx::PgPool;

use crate::{auth::JwtVerifier, config::Config, db, push::Fcm, realtime::Hub};

/// Shared state handed to every request handler.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub auth: Arc<JwtVerifier>,
    pub db: PgPool,
    pub hub: Hub,
    /// Firebase Cloud Messaging client, `None` when push is not configured.
    pub push: Option<Arc<Fcm>>,
}

impl AppState {
    pub fn new(config: Config) -> anyhow::Result<Self> {
        let auth = JwtVerifier::new(
            config.supabase_url.as_deref(),
            config.supabase_jwt_secret.as_deref(),
        )?;
        let db = db::connect_lazy(&config.database_url)?;

        let push = match &config.fcm_service_account {
            Some(account) => {
                let fcm = Fcm::new(account.clone(), &config.fcm_api_url)
                    .context("FCM_SERVICE_ACCOUNT cannot be used")?;
                tracing::info!(
                    project = fcm.project_id(),
                    "push notifications enabled (Firebase Cloud Messaging)"
                );
                Some(Arc::new(fcm))
            }
            None => {
                tracing::info!("FCM_SERVICE_ACCOUNT is not set: push notifications are disabled");
                None
            }
        };

        Ok(Self {
            config: Arc::new(config),
            auth: Arc::new(auth),
            db,
            hub: Hub::default(),
            push,
        })
    }
}
