import { randomUUID } from 'expo-crypto';

import type { RealtimeListener } from '@/data/realtime';
import type { BubbleData, DataSource } from '@/data/source';
import type { CalendarEvent, Couple, Goal, Memory, Message, Mood } from '@/data/types';
import type { Me } from '@/state/session';

export const DEMO_PARTNER_ID = 'demo-partner';
/** Demo media have no file: the app draws an illustrated tile instead. */
export const DEMO_MEDIA_PREFIX = 'demo:';

const MINUTE = 60_000;
const DAY = 1440 * MINUTE;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const day = (offsetDays: number) => iso(offsetDays * DAY).slice(0, 10);

function removeWhere<T>(list: T[], match: (item: T) => boolean) {
  const index = list.findIndex(match);
  if (index >= 0) list.splice(index, 1);
}

const REPLIES = ['Trop mignon 🥰', 'Haha j’adore', 'Moi aussi ❤️', 'On en parle ce soir ?', '😍', 'Tu me manques…'];

/** Local sample data: the app can be explored without any server. */
export function createDemoSource(me: Me): DataSource {
  const couple: Couple = {
    id: 'demo-couple',
    complete: true,
    invite: null,
    togetherSince: '2023-02-14',
    createdAt: iso(-600 * DAY),
    members: [
      { userId: me.id, seat: 1, displayName: me.displayName, avatarUrl: me.avatarUrl, joinedAt: iso(-600 * DAY) },
      { userId: DEMO_PARTNER_ID, seat: 2, displayName: 'Léa', avatarUrl: null, joinedAt: iso(-599 * DAY) },
    ],
  };

  return {
    mode: 'demo',
    me,
    getCouple: async () => couple,
    createCouple: async () => couple,
    joinCouple: async () => couple,
    renewInvite: async () => couple,
    // No server, no notifications.
    registerDevice: async () => undefined,
    unregisterDevice: async () => undefined,
    bubble: () => demoBubble(me),
  };
}

function message(partial: Partial<Message> & Pick<Message, 'id' | 'senderId' | 'createdAt'>): Message {
  return {
    kind: 'text',
    body: null,
    mediaPath: null,
    durationMs: null,
    readAt: null,
    reactions: {},
    status: 'sent',
    ...partial,
  };
}

function demoBubble(me: Me): BubbleData {
  const moods: Mood[] = [
    { userId: me.id, energy: 70, mood: 80, updatedAt: iso(-120 * MINUTE) },
    { userId: DEMO_PARTNER_ID, energy: 55, mood: 90, updatedAt: iso(-30 * MINUTE) },
  ];

  const events: CalendarEvent[] = [
    { id: 'e1', title: 'Week-end à la mer', startsAt: iso(3 * DAY + 240 * MINUTE), color: 'peach', createdBy: DEMO_PARTNER_ID },
    { id: 'e2', title: 'Dîner chez Mamie', startsAt: iso(9 * DAY), color: 'lilac', createdBy: me.id },
    { id: 'e3', title: 'Concert', startsAt: iso(17 * DAY), color: 'butter', createdBy: DEMO_PARTNER_ID },
  ];

  const memories: Memory[] = [
    memory('m1', 'Coucher de soleil', 'trip', day(-2), true, DEMO_PARTNER_ID),
    memory('m2', 'Soirée crêpes', 'night', day(-9), false, me.id),
    memory('m3', 'Notre restaurant', 'date', day(-16), true, me.id),
    memory('m4', 'Balade du dimanche', 'simple', day(-23), false, DEMO_PARTNER_ID),
    memory('m5', 'Road trip', 'trip', day(-40), false, me.id),
    memory('m6', 'Pique-nique', 'simple', day(-58), true, DEMO_PARTNER_ID),
  ];

  const goals: Goal[] = [
    { id: 'g1', title: 'Prochain voyage : Lisbonne', doneAt: null, createdAt: iso(-30 * DAY), createdBy: DEMO_PARTNER_ID },
    { id: 'g2', title: 'Essayer le nouveau resto', doneAt: iso(-3 * DAY), createdAt: iso(-20 * DAY), createdBy: me.id },
    { id: 'g3', title: 'Apprendre à faire des sushis', doneAt: null, createdAt: iso(-10 * DAY), createdBy: me.id },
  ];

  // Newest first, like the live data.
  const messages: Message[] = [
    message({ id: 'd6', senderId: DEMO_PARTNER_ID, kind: 'image', mediaPath: `${DEMO_MEDIA_PREFIX}night`, createdAt: iso(-12 * MINUTE) }),
    message({ id: 'd5', senderId: DEMO_PARTNER_ID, kind: 'voice', mediaPath: `${DEMO_MEDIA_PREFIX}voice`, durationMs: 12_000, createdAt: iso(-14 * MINUTE) }),
    message({ id: 'd4', senderId: me.id, body: 'Ce que tu veux ! ❤️', createdAt: iso(-20 * MINUTE), readAt: iso(-19 * MINUTE), reactions: { [DEMO_PARTNER_ID]: '😍' } }),
    message({ id: 'd3', senderId: DEMO_PARTNER_ID, body: 'On se fait quoi ce soir ? 😊', createdAt: iso(-22 * MINUTE) }),
    message({ id: 'd2', senderId: me.id, body: 'Bonne journée mon cœur ☀️', createdAt: iso(-DAY - 300 * MINUTE), readAt: iso(-DAY - 290 * MINUTE) }),
    message({ id: 'd1', senderId: DEMO_PARTNER_ID, body: 'Coucou toi', createdAt: iso(-DAY - 310 * MINUTE) }),
  ];

  return {
    listMessages: async (before) => (before ? [] : messages),
    uploadMedia: async (localUri) => localUri,
    listMoods: async () => moods,
    listEvents: async () => events,
    addEvent: async (event) => {
      const created = { id: randomUUID(), createdBy: me.id, ...event };
      events.push(created);
      return created;
    },
    deleteEvent: async (id) => {
      removeWhere(events, (e) => e.id === id);
    },
    listMemories: async () => memories,
    addMemory: async (input) => {
      const created: Memory = {
        id: randomUUID(),
        title: input.title,
        note: null,
        category: input.category,
        // The picked file itself: mediaUrl() returns it as is.
        photoPath: input.localUri,
        takenOn: input.takenOn,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        createdBy: me.id,
      };
      memories.unshift(created);
      return created;
    },
    deleteMemory: async (target) => {
      removeWhere(memories, (m) => m.id === target.id);
    },
    setMemoryFavorite: async (id, favorite) => {
      const found = memories.find((m) => m.id === id);
      if (found) found.isFavorite = favorite;
    },
    listGoals: async () => goals,
    addGoal: async (title) => {
      const created: Goal = { id: randomUUID(), title, doneAt: null, createdAt: new Date().toISOString(), createdBy: me.id };
      goals.push(created);
      return created;
    },
    setGoalDone: async (id, done) => {
      const found = goals.find((g) => g.id === id);
      if (found) found.doneAt = done ? new Date().toISOString() : null;
    },
    deleteGoal: async (id) => {
      removeWhere(goals, (g) => g.id === id);
    },
    subscribeAlbum: () => () => undefined,
    mediaUrl: async (path) => (path.startsWith(DEMO_MEDIA_PREFIX) ? null : path),
    connect: (listener) => demoConnection(me, listener),
  };
}

function memory(
  id: string,
  title: string,
  category: Memory['category'],
  takenOn: string,
  isFavorite: boolean,
  createdBy: string,
): Memory {
  return {
    id,
    title,
    note: null,
    category,
    photoPath: `${DEMO_MEDIA_PREFIX}${category}`,
    takenOn,
    isFavorite,
    createdAt: `${takenOn}T18:00:00.000Z`,
    createdBy,
  };
}

/** A pretend channel where Léa is always online and answers. */
function demoConnection(me: Me, listener: RealtimeListener) {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  };
  const frame = (payload: Record<string, unknown>) => listener.onEvent({ type: 'frame', frame: payload });

  listener.onStatus('connecting');
  later(250, () => {
    listener.onStatus('open');
    listener.onEvent({ type: 'ready', partnerOnline: true });
  });

  return {
    send: (sent: Record<string, unknown>) => {
      switch (sent.type) {
        case 'mood.set': {
          const mood: Mood = {
            userId: me.id,
            energy: Number(sent.energy),
            mood: Number(sent.mood),
            updatedAt: new Date().toISOString(),
          };
          later(80, () => listener.onEvent({ type: 'mood', mood }));
          break;
        }
        case 'message.send': {
          const echoed = {
            id: sent.id,
            sender_id: me.id,
            kind: sent.kind,
            body: sent.body ?? null,
            media_path: sent.media_path ?? null,
            duration_ms: sent.duration_ms ?? null,
            created_at: new Date().toISOString(),
            read_at: null,
          };
          later(120, () => frame({ type: 'message.new', message: echoed }));
          later(900, () => frame({ type: 'message.read', reader_id: DEMO_PARTNER_ID, until: echoed.created_at }));
          later(1300, () => frame({ type: 'typing', user_id: DEMO_PARTNER_ID, active: true }));
          later(2800, () => {
            frame({ type: 'typing', user_id: DEMO_PARTNER_ID, active: false });
            frame({
              type: 'message.new',
              message: {
                id: randomUUID(),
                sender_id: DEMO_PARTNER_ID,
                kind: 'text',
                body: REPLIES[Math.floor(Math.random() * REPLIES.length)],
                media_path: null,
                duration_ms: null,
                created_at: new Date().toISOString(),
                read_at: null,
              },
            });
          });
          break;
        }
        case 'reaction.set':
        case 'reaction.clear':
          later(80, () =>
            frame({
              type: 'reaction',
              message_id: sent.message_id,
              user_id: me.id,
              emoji: sent.type === 'reaction.set' ? sent.emoji : null,
            }),
          );
          break;
      }
    },
    close: () => {
      timers.forEach(clearTimeout);
      timers.clear();
      listener.onStatus('closed');
    },
  };
}
