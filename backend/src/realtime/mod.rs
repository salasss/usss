//! Realtime channel between the two phones of a couple, over `/ws`.
//!
//! Each couple with a connected device gets an in-memory room. Messages,
//! read receipts, reactions and moods are written to the database first,
//! then pushed to both phones; typing indicators and presence are only
//! relayed. See [`protocol`] for the JSON frames.

mod hub;
pub mod protocol;
pub mod session;
pub mod store;

pub use hub::Hub;
