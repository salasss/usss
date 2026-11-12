use std::sync::Arc;

use crate::{auth::JwtVerifier, config::Config};

/// Shared state handed to every request handler.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub auth: Arc<JwtVerifier>,
}

impl AppState {
    pub fn new(config: Config) -> anyhow::Result<Self> {
        let auth = JwtVerifier::new(
            config.supabase_url.as_deref(),
            config.supabase_jwt_secret.as_deref(),
        )?;

        Ok(Self {
            config: Arc::new(config),
            auth: Arc::new(auth),
        })
    }
}
