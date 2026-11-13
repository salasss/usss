//! Push tokens of each person's phones (`public.push_tokens`).

use sqlx::PgPool;
use uuid::Uuid;

/// Phones kept per person: reinstalling the app gives a new token, and the
/// oldest ones beyond this are dropped instead of piling up.
const MAX_PHONES_PER_PERSON: i64 = 10;

/// Registers `token` for `user`, taking it over if another account had it
/// (someone else signed in on that phone).
pub async fn register(pool: &PgPool, user: Uuid, token: &str) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        "insert into public.push_tokens (token, user_id) values ($1, $2)
         on conflict (token) do update set user_id = excluded.user_id, updated_at = now()",
    )
    .bind(token)
    .bind(user)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "delete from public.push_tokens
         where user_id = $1
           and token not in (
             select token from public.push_tokens
             where user_id = $1
             order by updated_at desc
             limit $2
           )",
    )
    .bind(user)
    .bind(MAX_PHONES_PER_PERSON)
    .execute(&mut *tx)
    .await?;
    tx.commit().await
}

/// Removes `token` if it belongs to `user`.
pub async fn unregister(pool: &PgPool, user: Uuid, token: &str) -> Result<(), sqlx::Error> {
    sqlx::query("delete from public.push_tokens where token = $1 and user_id = $2")
        .bind(token)
        .bind(user)
        .execute(pool)
        .await?;
    Ok(())
}

/// Removes a token FCM no longer accepts.
pub async fn forget(pool: &PgPool, token: &str) -> Result<(), sqlx::Error> {
    sqlx::query("delete from public.push_tokens where token = $1")
        .bind(token)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn tokens_of(pool: &PgPool, user: Uuid) -> Result<Vec<String>, sqlx::Error> {
    sqlx::query_scalar("select token from public.push_tokens where user_id = $1")
        .bind(user)
        .fetch_all(pool)
        .await
}

/// The partner of `sender` in `couple`, and the name `sender` goes by.
pub async fn recipient(
    pool: &PgPool,
    couple: Uuid,
    sender: Uuid,
) -> Result<Option<(Uuid, String)>, sqlx::Error> {
    sqlx::query_as(
        "select partner.user_id, sender.display_name
         from public.couple_members as partner
         join public.profiles as sender on sender.id = $2
         where partner.couple_id = $1 and partner.user_id <> $2",
    )
    .bind(couple)
    .bind(sender)
    .fetch_optional(pool)
    .await
}
