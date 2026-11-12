import { randomUUID } from 'expo-crypto';

import type { RealtimeListener } from '@/data/realtime';
import type { BubbleData, DataSource } from '@/data/source';
import type { CalendarEvent, Couple, Memory, Mood } from '@/data/types';
import type { Me } from '@/state/session';

export const DEMO_PARTNER_ID = 'demo-partner';
/** Demo memories have no photo: the app draws an illustrated tile instead. */
export const DEMO_MEDIA_PREFIX = 'demo:';

const DAY = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const day = (offsetDays: number) => iso(offsetDays * DAY).slice(0, 10);

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
    bubble: () => demoBubble(me),
  };
}

function demoBubble(me: Me): BubbleData {
  const moods: Mood[] = [
    { userId: me.id, energy: 70, mood: 80, updatedAt: iso(-2 * 3600 * 1000) },
    { userId: DEMO_PARTNER_ID, energy: 55, mood: 90, updatedAt: iso(-30 * 60 * 1000) },
  ];

  const events: CalendarEvent[] = [
    { id: 'e1', title: 'Week-end à la mer', startsAt: iso(3 * DAY + 4 * 3600 * 1000), color: 'peach', createdBy: DEMO_PARTNER_ID },
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

  return {
    listMoods: async () => moods,
    listEvents: async () => events,
    addEvent: async (event) => {
      const created = { id: randomUUID(), createdBy: me.id, ...event };
      events.push(created);
      return created;
    },
    listMemories: async () => memories,
    setMemoryFavorite: async (id, favorite) => {
      const found = memories.find((m) => m.id === id);
      if (found) found.isFavorite = favorite;
    },
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

/** A pretend channel where Léa is always online. */
function demoConnection(me: Me, listener: RealtimeListener) {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  };

  listener.onStatus('connecting');
  later(250, () => {
    listener.onStatus('open');
    listener.onEvent({ type: 'ready', partnerOnline: true });
  });

  return {
    send: (frame: Record<string, unknown>) => {
      if (frame.type === 'mood.set') {
        const mood: Mood = {
          userId: me.id,
          energy: Number(frame.energy),
          mood: Number(frame.mood),
          updatedAt: new Date().toISOString(),
        };
        later(80, () => listener.onEvent({ type: 'mood', mood }));
      }
    },
    close: () => {
      timers.forEach(clearTimeout);
      timers.clear();
      listener.onStatus('closed');
    },
  };
}
