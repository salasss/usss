//! usss backend: HTTP API and realtime server for the two members of a couple.

pub mod config;
pub mod routes;
pub mod state;

pub use routes::router;
pub use state::AppState;
