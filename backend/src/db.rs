use std::time::Duration;

use sqlx::{PgPool, postgres::PgPoolOptions};

/// Connection pool to the Supabase Postgres database.
///
/// Lazy: the server starts (and `/health` answers) even if the database is
/// briefly unreachable. Use a direct or *session* pooler connection string:
/// prepared statements do not survive the transaction pooler.
pub fn connect_lazy(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .acquire_timeout(Duration::from_secs(5))
        .connect_lazy(database_url)?;
    Ok(pool)
}
