use std::sync::Arc;

use sqlx::PgPool;

use crate::{auth::JwtVerifier, config::Config, db, realtime::Hub};

/// Shared state handed to every request handler.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub auth: Arc<JwtVerifier>,
    pub db: PgPool,
    pub hub: Hub,
}

impl AppState {
    pub fn new(config: Config) -> anyhow::Result<Self> {
        let auth = JwtVerifier::new(
            config.supabase_url.as_deref(),
            config.supabase_jwt_secret.as_deref(),
        )?;
        let db = db::connect_lazy(&config.database_url)?;

        Ok(Self {
            config: Arc::new(config),
            auth: Arc::new(auth),
            db,
            hub: Hub::default(),
        })
    }
}
