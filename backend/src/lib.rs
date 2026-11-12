//! usss backend: HTTP API and realtime server for the two members of a couple.

pub mod auth;
pub mod config;
pub mod error;
pub mod routes;
pub mod state;

pub use routes::router;
pub use state::AppState;
