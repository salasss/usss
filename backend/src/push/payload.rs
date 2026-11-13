//! What a notification says, and the FCM request that carries it.

use serde_json::{Value, json};
use uuid::Uuid;

use crate::realtime::protocol::MessageKind;

/// Android notification channel the app creates for chat messages.
pub const CHANNEL_ID: &str = "messages";
/// Title when the sender has no display name.
const FALLBACK_TITLE: &str = "usss";
/// Longest message text shown in a notification.
const MAX_PREVIEW_CHARS: usize = 120;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Notification {
    pub title: String,
    pub body: String,
}

impl Notification {
    /// A notification from `sender_name` showing `preview` (see [`preview`]).
    pub fn new(sender_name: &str, preview: String) -> Self {
        let name = sender_name.trim();
        Self {
            title: if name.is_empty() {
                FALLBACK_TITLE.to_owned()
            } else {
                name.to_owned()
            },
            body: preview,
        }
    }
}

/// The line shown for a message: its text, shortened, or what it contains.
pub fn preview(kind: MessageKind, body: Option<&str>) -> String {
    match kind {
        MessageKind::Text => shorten(body.unwrap_or_default(), MAX_PREVIEW_CHARS),
        MessageKind::Image => "📷 Photo".to_owned(),
        MessageKind::Voice => "🎤 Message vocal".to_owned(),
    }
}

/// Body of `POST /v1/projects/{project}/messages:send` for one phone.
pub fn fcm_message(token: &str, notification: &Notification, couple: Uuid) -> Value {
    json!({
        "message": {
            "token": token,
            "notification": {
                "title": notification.title,
                "body": notification.body,
            },
            // Read by the app when the notification is tapped.
            "data": {
                "type": "message",
                "couple_id": couple.to_string(),
            },
            "android": {
                "priority": "HIGH",
                "notification": { "channel_id": CHANNEL_ID },
            },
        }
    })
}

/// `text` trimmed to at most `max` characters, an ellipsis marking the cut.
fn shorten(text: &str, max: usize) -> String {
    let text = text.trim();
    if text.chars().count() <= max {
        return text.to_owned();
    }
    let kept: String = text.chars().take(max - 1).collect();
    format!("{}…", kept.trim_end())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_messages_are_shown_shortened() {
        assert_eq!(
            preview(MessageKind::Text, Some("  On se fait quoi ce soir ?\n")),
            "On se fait quoi ce soir ?"
        );

        let long = "é".repeat(300);
        let shown = preview(MessageKind::Text, Some(&long));
        assert_eq!(shown.chars().count(), MAX_PREVIEW_CHARS);
        assert!(shown.ends_with('…'));

        let exact = "a".repeat(MAX_PREVIEW_CHARS);
        assert_eq!(preview(MessageKind::Text, Some(&exact)), exact);
    }

    #[test]
    fn media_messages_say_what_they_contain() {
        assert_eq!(preview(MessageKind::Image, Some("vue")), "📷 Photo");
        assert_eq!(preview(MessageKind::Image, None), "📷 Photo");
        assert_eq!(preview(MessageKind::Voice, None), "🎤 Message vocal");
    }

    #[test]
    fn the_title_is_the_sender_name() {
        assert_eq!(Notification::new(" Léa ", "Coucou".into()).title, "Léa");
        assert_eq!(Notification::new("", "Coucou".into()).title, "usss");
        assert_eq!(Notification::new("   ", "Coucou".into()).title, "usss");
    }

    #[test]
    fn fcm_message_targets_the_messages_channel() {
        let couple = Uuid::new_v4();
        let notification = Notification::new("Léa", "Coucou".into());

        assert_eq!(
            fcm_message("phone-token", &notification, couple),
            json!({
                "message": {
                    "token": "phone-token",
                    "notification": { "title": "Léa", "body": "Coucou" },
                    "data": { "type": "message", "couple_id": couple.to_string() },
                    "android": {
                        "priority": "HIGH",
                        "notification": { "channel_id": "messages" },
                    },
                }
            })
        );
    }
}
