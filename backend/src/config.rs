use std::net::{IpAddr, SocketAddr};

use anyhow::Context;

/// Runtime configuration, read from the environment (and from `.env` in development).
#[derive(Clone, Debug)]
pub struct Config {
    /// Address the HTTP server binds to (`HOST` + `PORT`).
    pub addr: SocketAddr,
    /// Supabase project URL (`SUPABASE_URL`): enables the JWKS signing keys
    /// and the issuer check of access tokens.
    pub supabase_url: Option<String>,
    /// Legacy HS256 JWT secret of the project (`SUPABASE_JWT_SECRET`).
    pub supabase_jwt_secret: Option<String>,
    /// Postgres connection string of the Supabase database (`DATABASE_URL`).
    pub database_url: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let host: IpAddr = env_or("HOST", "0.0.0.0")
            .parse()
            .context("HOST must be an IP address")?;
        let port: u16 = env_or("PORT", "8080")
            .parse()
            .context("PORT must be a valid port number")?;

        Ok(Self {
            addr: SocketAddr::new(host, port),
            supabase_url: optional_env("SUPABASE_URL")
                .map(|url| url.trim_end_matches('/').to_owned()),
            supabase_jwt_secret: optional_env("SUPABASE_JWT_SECRET"),
            database_url: optional_env("DATABASE_URL")
                .context("DATABASE_URL is required (Supabase > Connect > Session pooler)")?,
        })
    }
}

/// Reads an environment variable, falling back to `default` when unset or blank.
fn env_or(key: &str, default: &str) -> String {
    optional_env(key).unwrap_or_else(|| default.to_owned())
}

/// Reads an environment variable, treating blank values as unset.
pub(crate) fn optional_env(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}
