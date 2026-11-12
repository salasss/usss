use chrono::{DateTime, NaiveDate, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use super::{CoupleError, CoupleView, INVITE_TTL_HOURS, Invite, Member, code};

/// Attempts to find a free invite code before giving up (collisions are
/// astronomically unlikely with 32^8 codes).
const CODE_ATTEMPTS: usize = 5;

#[derive(sqlx::FromRow)]
struct CoupleRow {
    id: Uuid,
    invite_code: Option<String>,
    invite_expires_at: Option<DateTime<Utc>>,
    invite_expired: Option<bool>,
    together_since: Option<NaiveDate>,
    created_at: DateTime<Utc>,
}

/// The couple of `user`, with its members, or `None` when single.
pub async fn couple_of(pool: &PgPool, user: Uuid) -> Result<Option<CoupleView>, sqlx::Error> {
    let mut conn = pool.acquire().await?;
    load_view(&mut conn, user).await
}

/// Creates a couple with `user` in the first seat and a fresh invite code.
pub async fn create(pool: &PgPool, user: Uuid) -> Result<CoupleView, CoupleError> {
    let mut tx = pool.begin().await?;
    ensure_profile(&mut tx, user).await?;

    if membership(&mut tx, user).await?.is_some() {
        return Err(CoupleError::AlreadyPaired);
    }

    let mut couple_id = None;
    for _ in 0..CODE_ATTEMPTS {
        couple_id = sqlx::query_scalar::<_, Uuid>(
            "insert into public.couples (created_by, invite_code, invite_expires_at)
             values ($1, $2, now() + make_interval(hours => $3))
             on conflict (invite_code) do nothing
             returning id",
        )
        .bind(user)
        .bind(code::generate())
        .bind(INVITE_TTL_HOURS)
        .fetch_optional(&mut *tx)
        .await?;
        if couple_id.is_some() {
            break;
        }
    }
    let couple_id = couple_id.ok_or_else(|| {
        CoupleError::Database(sqlx::Error::Protocol("no free invite code".into()))
    })?;

    add_member(&mut tx, couple_id, user, 1).await?;
    tx.commit().await?;

    view_or_missing(pool, user).await
}

/// Replaces the invite code of `user`'s couple while it waits for a partner.
pub async fn renew_invite(pool: &PgPool, user: Uuid) -> Result<CoupleView, CoupleError> {
    let mut tx = pool.begin().await?;
    let couple_id = membership(&mut tx, user)
        .await?
        .ok_or(CoupleError::NotPaired)?;

    // Lock the couple so a partner joining right now is not given a stale code.
    sqlx::query("select 1 from public.couples where id = $1 for update")
        .bind(couple_id)
        .execute(&mut *tx)
        .await?;
    if member_count(&mut tx, couple_id).await? >= 2 {
        return Err(CoupleError::CoupleComplete);
    }

    let mut renewed = false;
    for _ in 0..CODE_ATTEMPTS {
        let candidate = code::generate();
        let updated = sqlx::query(
            "update public.couples
             set invite_code = $2, invite_expires_at = now() + make_interval(hours => $3)
             where id = $1
               and not exists (select 1 from public.couples where invite_code = $2)",
        )
        .bind(couple_id)
        .bind(&candidate)
        .bind(INVITE_TTL_HOURS)
        .execute(&mut *tx)
        .await?;
        if updated.rows_affected() == 1 {
            renewed = true;
            break;
        }
    }
    if !renewed {
        return Err(CoupleError::Database(sqlx::Error::Protocol(
            "no free invite code".into(),
        )));
    }

    tx.commit().await?;
    view_or_missing(pool, user).await
}

/// Makes `user` join the couple behind `raw_code`.
///
/// Someone alone in a couple they created, with nothing in it yet, leaves it
/// to join their partner's (both of them created a couple at the same time).
pub async fn join(pool: &PgPool, user: Uuid, raw_code: &str) -> Result<CoupleView, CoupleError> {
    let code = code::normalize(raw_code).ok_or(CoupleError::MalformedCode)?;

    let mut tx = pool.begin().await?;
    ensure_profile(&mut tx, user).await?;

    // Locking the couple row serializes concurrent joins on the same code.
    let (couple_id, expired) = sqlx::query_as::<_, (Uuid, bool)>(
        "select id, invite_expires_at <= now()
         from public.couples
         where invite_code = $1
         for update",
    )
    .bind(&code)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(CoupleError::InviteNotFound)?;

    if expired {
        return Err(CoupleError::InviteExpired);
    }

    match membership(&mut tx, user).await? {
        Some(current) if current == couple_id => return Err(CoupleError::AlreadyPaired),
        Some(current) => {
            if !is_empty_solo_couple(&mut tx, current).await? {
                return Err(CoupleError::AlreadyPaired);
            }
            sqlx::query("delete from public.couples where id = $1")
                .bind(current)
                .execute(&mut *tx)
                .await?;
        }
        None => {}
    }

    let seats: Vec<i16> = sqlx::query_scalar(
        "select seat from public.couple_members where couple_id = $1 for update",
    )
    .bind(couple_id)
    .fetch_all(&mut *tx)
    .await?;
    if seats.len() >= 2 {
        return Err(CoupleError::CoupleComplete);
    }
    let seat = if seats.contains(&1) { 2 } else { 1 };
    add_member(&mut tx, couple_id, user, seat).await?;

    if seats.len() + 1 == 2 {
        // Complete: the code must not let anyone else in.
        sqlx::query(
            "update public.couples set invite_code = null, invite_expires_at = null where id = $1",
        )
        .bind(couple_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    view_or_missing(pool, user).await
}

// -----------------------------------------------------------------------------

async fn view_or_missing(pool: &PgPool, user: Uuid) -> Result<CoupleView, CoupleError> {
    couple_of(pool, user).await?.ok_or(CoupleError::NotPaired)
}

async fn load_view(conn: &mut PgConnection, user: Uuid) -> Result<Option<CoupleView>, sqlx::Error> {
    let Some(row) = sqlx::query_as::<_, CoupleRow>(
        "select c.id, c.invite_code, c.invite_expires_at,
                c.invite_expires_at <= now() as invite_expired,
                c.together_since, c.created_at
         from public.couples as c
         join public.couple_members as m on m.couple_id = c.id
         where m.user_id = $1",
    )
    .bind(user)
    .fetch_optional(&mut *conn)
    .await?
    else {
        return Ok(None);
    };

    let members = sqlx::query_as::<_, Member>(
        "select m.user_id, m.seat, p.display_name, p.avatar_url, m.joined_at
         from public.couple_members as m
         join public.profiles as p on p.id = m.user_id
         where m.couple_id = $1
         order by m.seat",
    )
    .bind(row.id)
    .fetch_all(&mut *conn)
    .await?;

    let invite = match (row.invite_code, row.invite_expires_at) {
        (Some(code), Some(expires_at)) => Some(Invite {
            code,
            expires_at,
            expired: row.invite_expired.unwrap_or(false),
        }),
        _ => None,
    };

    Ok(Some(CoupleView {
        id: row.id,
        complete: members.len() >= 2,
        invite,
        together_since: row.together_since,
        created_at: row.created_at,
        members,
    }))
}

/// Profiles are created by the auth trigger; this covers accounts that
/// existed before it.
async fn ensure_profile(conn: &mut PgConnection, user: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("insert into public.profiles (id) values ($1) on conflict (id) do nothing")
        .bind(user)
        .execute(conn)
        .await?;
    Ok(())
}

async fn membership(conn: &mut PgConnection, user: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("select couple_id from public.couple_members where user_id = $1 for update")
        .bind(user)
        .fetch_optional(conn)
        .await
}

async fn member_count(conn: &mut PgConnection, couple_id: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("select count(*) from public.couple_members where couple_id = $1")
        .bind(couple_id)
        .fetch_one(conn)
        .await
}

async fn is_empty_solo_couple(
    conn: &mut PgConnection,
    couple_id: Uuid,
) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "select (select count(*) from public.couple_members where couple_id = $1) = 1
            and not exists (select 1 from public.messages where couple_id = $1)
            and not exists (select 1 from public.memories where couple_id = $1)
            and not exists (select 1 from public.goals where couple_id = $1)
            and not exists (select 1 from public.events where couple_id = $1)",
    )
    .bind(couple_id)
    .fetch_one(conn)
    .await
}

async fn add_member(
    conn: &mut PgConnection,
    couple_id: Uuid,
    user: Uuid,
    seat: i16,
) -> Result<(), CoupleError> {
    let inserted = sqlx::query(
        "insert into public.couple_members (couple_id, user_id, seat) values ($1, $2, $3)",
    )
    .bind(couple_id)
    .bind(user)
    .bind(seat)
    .execute(conn)
    .await;

    match inserted {
        Ok(_) => Ok(()),
        Err(sqlx::Error::Database(db)) if db.is_unique_violation() => {
            // The constraints settle races the locks did not see.
            if db.constraint() == Some("couple_members_one_couple_per_user") {
                Err(CoupleError::AlreadyPaired)
            } else {
                Err(CoupleError::CoupleComplete)
            }
        }
        Err(err) => Err(err.into()),
    }
}
