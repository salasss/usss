use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use tokio::sync::broadcast;
use uuid::Uuid;

use super::protocol::ServerEvent;

/// Events buffered per couple before a slow connection is told to resync.
const ROOM_CAPACITY: usize = 256;

/// A serialized event for one couple, optionally hidden from one person
/// (the author of a typing indicator does not need it back).
#[derive(Debug)]
pub struct Outgoing {
    pub json: String,
    pub except: Option<Uuid>,
}

struct Room {
    sender: broadcast::Sender<Arc<Outgoing>>,
    /// Open connections per person (a phone may reconnect before the old
    /// socket is noticed as closed).
    connections: HashMap<Uuid, usize>,
}

/// In-memory rooms, one per couple with at least one connected device.
#[derive(Clone, Default)]
pub struct Hub {
    rooms: Arc<Mutex<HashMap<Uuid, Room>>>,
}

pub struct Joined {
    pub receiver: broadcast::Receiver<Arc<Outgoing>>,
    /// Whether the other partner is connected right now.
    pub partner_online: bool,
    /// First connection of this person: the partner should see them online.
    pub came_online: bool,
}

impl Hub {
    pub fn join(&self, couple: Uuid, user: Uuid) -> Joined {
        let mut rooms = self.rooms.lock().expect("hub lock");
        let room = rooms.entry(couple).or_insert_with(|| Room {
            sender: broadcast::channel(ROOM_CAPACITY).0,
            connections: HashMap::new(),
        });

        let count = room.connections.entry(user).or_insert(0);
        *count += 1;
        let came_online = *count == 1;
        let partner_online = room
            .connections
            .iter()
            .any(|(id, count)| *id != user && *count > 0);

        Joined {
            receiver: room.sender.subscribe(),
            partner_online,
            came_online,
        }
    }

    /// Returns `true` when this was the person's last connection.
    pub fn leave(&self, couple: Uuid, user: Uuid) -> bool {
        let mut rooms = self.rooms.lock().expect("hub lock");
        let Some(room) = rooms.get_mut(&couple) else {
            return false;
        };

        let went_offline = match room.connections.get_mut(&user) {
            Some(count) if *count > 1 => {
                *count -= 1;
                false
            }
            Some(_) => {
                room.connections.remove(&user);
                true
            }
            None => false,
        };

        if room.connections.is_empty() {
            rooms.remove(&couple);
        }
        went_offline
    }

    pub fn publish(&self, couple: Uuid, event: &ServerEvent, except: Option<Uuid>) {
        let rooms = self.rooms.lock().expect("hub lock");
        if let Some(room) = rooms.get(&couple) {
            // No receiver left is not an error: nobody is listening.
            let _ = room.sender.send(Arc::new(Outgoing {
                json: event.to_json(),
                except,
            }));
        }
    }

    pub fn is_online(&self, couple: Uuid, user: Uuid) -> bool {
        let rooms = self.rooms.lock().expect("hub lock");
        rooms
            .get(&couple)
            .is_some_and(|room| room.connections.contains_key(&user))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presence_follows_connections() {
        let hub = Hub::default();
        let couple = Uuid::new_v4();
        let (lea, thomas) = (Uuid::new_v4(), Uuid::new_v4());

        let first = hub.join(couple, lea);
        assert!(first.came_online);
        assert!(!first.partner_online);

        let partner = hub.join(couple, thomas);
        assert!(partner.partner_online);

        // A second device for Léa does not make her "come online" again.
        assert!(!hub.join(couple, lea).came_online);
        assert!(!hub.leave(couple, lea));
        assert!(hub.leave(couple, lea));
        assert!(!hub.is_online(couple, lea));
        assert!(hub.is_online(couple, thomas));

        assert!(hub.leave(couple, thomas));
        assert!(
            hub.rooms.lock().unwrap().is_empty(),
            "empty rooms are dropped"
        );
    }

    #[test]
    fn couples_do_not_share_events() {
        let hub = Hub::default();
        let (ours, theirs) = (Uuid::new_v4(), Uuid::new_v4());
        let mut mine = hub.join(ours, Uuid::new_v4()).receiver;
        let mut other = hub.join(theirs, Uuid::new_v4()).receiver;

        hub.publish(ours, &ServerEvent::Pong, None);

        assert!(mine.try_recv().is_ok());
        assert!(other.try_recv().is_err());
    }
}
