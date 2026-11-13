//! Persistence of the realtime events. Every query is scoped to the couple
//! and the person of the connection, both established at connection time.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::protocol::{MessageKind, MessageRow, MoodRow};

pub async fn couple_of(pool: &PgPool, user: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("select couple_id from public.couple_members where user_id = $1")
        .bind(user)
        .fetch_optional(pool)
        .await
}

pub struct NewMessage<'a> {
    pub id: Uuid,
    pub kind: MessageKind,
    pub body: Option<&'a str>,
    pub media_path: Option<&'a str>,
    pub duration_ms: Option<i32>,
}

/// A stored message, and whether this call created it (`false` for a resend).
pub struct Stored {
    pub message: MessageRow,
    pub created: bool,
}

/// Inserts the message once; a resend with the same id returns the stored
/// row. `None` when the id is already used outside this couple.
pub async fn insert_message(
    pool: &PgPool,
    couple: Uuid,
    sender: Uuid,
    message: NewMessage<'_>,
) -> Result<Option<Stored>, sqlx::Error> {
    let inserted = sqlx::query_as::<_, MessageRow>(
        "insert into public.messages (id, couple_id, sender_id, kind, body, media_path, duration_ms)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do nothing
         returning id, couple_id, sender_id, kind, body, media_path, duration_ms, created_at, read_at",
    )
    .bind(message.id)
    .bind(couple)
    .bind(sender)
    .bind(message.kind)
    .bind(message.body)
    .bind(message.media_path)
    .bind(message.duration_ms)
    .fetch_optional(pool)
    .await?;

    if let Some(message) = inserted {
        return Ok(Some(Stored {
            message,
            created: true,
        }));
    }

    let existing = sqlx::query_as::<_, MessageRow>(
        "select id, couple_id, sender_id, kind, body, media_path, duration_ms, created_at, read_at
         from public.messages
         where id = $1 and couple_id = $2 and sender_id = $3",
    )
    .bind(message.id)
    .bind(couple)
    .bind(sender)
    .fetch_optional(pool)
    .await?;
    Ok(existing.map(|message| Stored {
        message,
        created: false,
    }))
}

/// Marks what the partner sent up to `until` as read; returns how many.
pub async fn mark_read(
    pool: &PgPool,
    couple: Uuid,
    reader: Uuid,
    until: DateTime<Utc>,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query(
        "update public.messages
         set read_at = now()
         where couple_id = $1
           and sender_id is distinct from $2
           and read_at is null
           and created_at <= $3",
    )
    .bind(couple)
    .bind(reader)
    .bind(until)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Sets the person's reaction on a message of their couple; `false` when
/// the message does not belong to the couple.
pub async fn set_reaction(
    pool: &PgPool,
    couple: Uuid,
    user: Uuid,
    message: Uuid,
    emoji: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "insert into public.message_reactions (message_id, user_id, emoji)
         select m.id, $2, $3
         from public.messages as m
         where m.id = $1 and m.couple_id = $4
         on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now()",
    )
    .bind(message)
    .bind(user)
    .bind(emoji)
    .bind(couple)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

pub async fn clear_reaction(
    pool: &PgPool,
    couple: Uuid,
    user: Uuid,
    message: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "delete from public.message_reactions as r
         using public.messages as m
         where r.message_id = $1 and r.user_id = $2
           and m.id = r.message_id and m.couple_id = $3",
    )
    .bind(message)
    .bind(user)
    .bind(couple)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() == 1)
}

pub async fn set_mood(
    pool: &PgPool,
    couple: Uuid,
    user: Uuid,
    energy: i16,
    mood: i16,
) -> Result<MoodRow, sqlx::Error> {
    sqlx::query_as::<_, MoodRow>(
        "insert into public.moods (user_id, couple_id, energy, mood)
         values ($1, $2, $3, $4)
         on conflict (user_id) do update
           set couple_id = excluded.couple_id, energy = excluded.energy, mood = excluded.mood
         returning user_id, energy, mood, updated_at",
    )
    .bind(user)
    .bind(couple)
    .bind(energy)
    .bind(mood)
    .fetch_one(pool)
    .await
}
