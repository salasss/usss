use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use tokio::{
    sync::{broadcast::error::RecvError, mpsc},
    time::{Instant, interval},
};
use uuid::Uuid;

use super::{
    protocol::{ClientEvent, MessageKind, ServerEvent},
    store::{self, NewMessage},
};
use crate::{auth::AuthUser, state::AppState};

/// Keep-alive ping, answered automatically by the phone.
const PING_EVERY: Duration = Duration::from_secs(25);
/// Without any frame for this long, the connection is considered dead.
const IDLE_TIMEOUT: Duration = Duration::from_secs(70);
const MAX_BODY_CHARS: usize = 4000;
const MAX_VOICE_MS: i32 = 10 * 60 * 1000;

/// Serves one WebSocket connection of `user` in `couple` until it closes.
pub async fn run(socket: WebSocket, state: AppState, user: AuthUser, couple: Uuid) {
    let me = user.id;
    let hub = state.hub.clone();
    let joined = hub.join(couple, me);
    let (mut sink, mut stream) = socket.split();
    let (direct, mut direct_rx) = mpsc::channel::<String>(32);
    let last_seen = Arc::new(Mutex::new(Instant::now()));

    let ready = ServerEvent::Ready {
        couple_id: couple,
        user_id: me,
        partner_online: joined.partner_online,
    };
    let _ = direct.send(ready.to_json()).await;
    if joined.came_online {
        hub.publish(
            couple,
            &ServerEvent::Presence {
                user_id: me,
                online: true,
            },
            Some(me),
        );
    }
    tracing::debug!(%couple, user = %me, "realtime connection opened");

    // Writer: room events, direct replies and keep-alive pings.
    let mut room = joined.receiver;
    let seen = last_seen.clone();
    let mut writer = tokio::spawn(async move {
        let mut ping = interval(PING_EVERY);
        ping.tick().await;
        loop {
            let frame = tokio::select! {
                event = room.recv() => match event {
                    Ok(out) if out.except == Some(me) => continue,
                    Ok(out) => Message::Text(out.json.clone().into()),
                    Err(RecvError::Lagged(_)) => Message::Text(ServerEvent::Resync.to_json().into()),
                    Err(RecvError::Closed) => break,
                },
                reply = direct_rx.recv() => match reply {
                    Some(json) => Message::Text(json.into()),
                    None => break,
                },
                _ = ping.tick() => {
                    if seen.lock().expect("last seen").elapsed() > IDLE_TIMEOUT {
                        let _ = sink.send(Message::Close(None)).await;
                        break;
                    }
                    Message::Ping(Default::default())
                }
            };
            if sink.send(frame).await.is_err() {
                break;
            }
        }
    });

    // Reader: frames from the phone.
    let reader = async {
        while let Some(Ok(frame)) = stream.next().await {
            *last_seen.lock().expect("last seen") = Instant::now();
            let text = match frame {
                Message::Text(text) => text,
                Message::Close(_) => break,
                _ => continue,
            };
            let reply = match serde_json::from_str::<ClientEvent>(text.as_str()) {
                Ok(event) => handle(&state, couple, me, event).await,
                Err(err) => Some(ServerEvent::error("bad_frame", err.to_string())),
            };
            if let Some(reply) = reply
                && direct.send(reply.to_json()).await.is_err()
            {
                break;
            }
        }
    };

    tokio::select! {
        _ = &mut writer => {}
        () = reader => {}
    }
    writer.abort();

    if hub.leave(couple, me) {
        hub.publish(
            couple,
            &ServerEvent::Presence {
                user_id: me,
                online: false,
            },
            None,
        );
    }
    tracing::debug!(%couple, user = %me, "realtime connection closed");
}

/// Applies one event. Results meant for the couple are published to the
/// room; the returned event (if any) goes back to this connection only.
async fn handle(
    state: &AppState,
    couple: Uuid,
    me: Uuid,
    event: ClientEvent,
) -> Option<ServerEvent> {
    let hub = &state.hub;
    let db = &state.db;

    match event {
        ClientEvent::Ping => Some(ServerEvent::Pong),

        ClientEvent::Typing { active } => {
            hub.publish(
                couple,
                &ServerEvent::Typing {
                    user_id: me,
                    active,
                },
                Some(me),
            );
            None
        }

        ClientEvent::SendMessage {
            id,
            kind,
            body,
            media_path,
            duration_ms,
        } => {
            let body = body
                .as_deref()
                .map(str::trim)
                .filter(|body| !body.is_empty());
            if let Err(reason) =
                validate_message(couple, kind, body, media_path.as_deref(), duration_ms)
            {
                return Some(ServerEvent::error("invalid_message", reason));
            }
            let message = NewMessage {
                id,
                kind,
                body,
                media_path: media_path.as_deref(),
                duration_ms,
            };
            match store::insert_message(db, couple, me, message).await {
                Ok(Some(message)) => {
                    hub.publish(couple, &ServerEvent::Message { message }, None);
                    None
                }
                Ok(None) => Some(ServerEvent::error(
                    "invalid_message",
                    "this message id is already used",
                )),
                Err(err) => Some(server_error("insert message", &err)),
            }
        }

        ClientEvent::MarkRead { until } => match store::mark_read(db, couple, me, until).await {
            Ok(0) => None,
            Ok(_) => {
                hub.publish(
                    couple,
                    &ServerEvent::Read {
                        reader_id: me,
                        until,
                    },
                    Some(me),
                );
                None
            }
            Err(err) => Some(server_error("mark read", &err)),
        },

        ClientEvent::SetReaction { message_id, emoji } => {
            let emoji = emoji.trim();
            if emoji.is_empty() || emoji.chars().count() > 16 {
                return Some(ServerEvent::error(
                    "invalid_reaction",
                    "one emoji is expected",
                ));
            }
            match store::set_reaction(db, couple, me, message_id, emoji).await {
                Ok(true) => {
                    let event = ServerEvent::Reaction {
                        message_id,
                        user_id: me,
                        emoji: Some(emoji.to_owned()),
                    };
                    hub.publish(couple, &event, None);
                    None
                }
                Ok(false) => Some(ServerEvent::error("not_found", "unknown message")),
                Err(err) => Some(server_error("set reaction", &err)),
            }
        }

        ClientEvent::ClearReaction { message_id } => {
            match store::clear_reaction(db, couple, me, message_id).await {
                Ok(true) => {
                    let event = ServerEvent::Reaction {
                        message_id,
                        user_id: me,
                        emoji: None,
                    };
                    hub.publish(couple, &event, None);
                    None
                }
                Ok(false) => None,
                Err(err) => Some(server_error("clear reaction", &err)),
            }
        }

        ClientEvent::SetMood { energy, mood } => {
            if !(0..=100).contains(&energy) || !(0..=100).contains(&mood) {
                return Some(ServerEvent::error("invalid_mood", "moods go from 0 to 100"));
            }
            match store::set_mood(db, couple, me, energy, mood).await {
                Ok(mood) => {
                    hub.publish(couple, &ServerEvent::Mood { mood }, None);
                    None
                }
                Err(err) => Some(server_error("set mood", &err)),
            }
        }
    }
}

fn validate_message(
    couple: Uuid,
    kind: MessageKind,
    body: Option<&str>,
    media_path: Option<&str>,
    duration_ms: Option<i32>,
) -> Result<(), &'static str> {
    if body.is_some_and(|body| body.chars().count() > MAX_BODY_CHARS) {
        return Err("the message is too long");
    }
    match kind {
        MessageKind::Text => {
            if body.is_none() {
                return Err("a text message needs a body");
            }
            if media_path.is_some() {
                return Err("a text message has no media");
            }
        }
        MessageKind::Image | MessageKind::Voice => {
            let Some(path) = media_path else {
                return Err("the media path is missing");
            };
            if !is_couple_media(couple, path) {
                return Err("the media must be in the couple's folder");
            }
            if kind == MessageKind::Voice
                && !duration_ms.is_some_and(|ms| (1..=MAX_VOICE_MS).contains(&ms))
            {
                return Err("a voice message lasts between 1 ms and 10 minutes");
            }
        }
    }
    Ok(())
}

/// `<couple_id>/<file>` in the couple-media bucket, without path tricks.
fn is_couple_media(couple: Uuid, path: &str) -> bool {
    let prefix = format!("{couple}/");
    path.len() <= 512
        && path.len() > prefix.len()
        && path.starts_with(&prefix)
        && !path.contains("..")
        && !path.contains("//")
        && !path.contains('\\')
}

fn server_error(action: &str, err: &sqlx::Error) -> ServerEvent {
    tracing::error!(error = %err, action, "realtime query failed");
    ServerEvent::error("server_error", "please try again")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_must_stay_in_the_couple_folder() {
        let couple = Uuid::new_v4();
        assert!(is_couple_media(couple, &format!("{couple}/photo.jpg")));
        assert!(is_couple_media(couple, &format!("{couple}/voice/1.m4a")));
        assert!(!is_couple_media(couple, "photo.jpg"));
        assert!(!is_couple_media(couple, &format!("{couple}/")));
        assert!(!is_couple_media(
            couple,
            &format!("{}/photo.jpg", Uuid::new_v4())
        ));
        assert!(!is_couple_media(
            couple,
            &format!("{couple}/../other/photo.jpg")
        ));
    }

    #[test]
    fn messages_are_validated_by_kind() {
        let couple = Uuid::new_v4();
        let media = format!("{couple}/a.m4a");
        assert!(validate_message(couple, MessageKind::Text, Some("Coucou"), None, None).is_ok());
        assert!(validate_message(couple, MessageKind::Text, None, None, None).is_err());
        assert!(
            validate_message(couple, MessageKind::Voice, None, Some(&media), Some(4_000)).is_ok()
        );
        assert!(validate_message(couple, MessageKind::Voice, None, Some(&media), None).is_err());
        assert!(
            validate_message(couple, MessageKind::Image, Some("vue"), Some(&media), None).is_ok()
        );
        let long = "a".repeat(MAX_BODY_CHARS + 1);
        assert!(validate_message(couple, MessageKind::Text, Some(&long), None, None).is_err());
    }
}
