use std::net::{IpAddr, SocketAddr};

use anyhow::Context;

/// Runtime configuration, read from the environment (and from `.env` in development).
#[derive(Clone, Debug)]
pub struct Config {
    /// Address the HTTP server binds to (`HOST` + `PORT`).
    pub addr: SocketAddr,
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
