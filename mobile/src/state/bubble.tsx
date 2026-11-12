import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { create } from 'zustand';

import type { ConnectionStatus, RealtimeConnection } from '@/data/realtime';
import type { AlbumTable, BubbleData } from '@/data/source';
import type { CalendarEvent, Goal, Memory, Mood, NewEvent, NewMemory } from '@/data/types';
import { useCouple } from '@/state/couple';
import { useSource } from '@/state/data';

type BubbleState = {
  connection: ConnectionStatus;
  partnerOnline: boolean;
  moods: Record<string, Mood>;
  events: CalendarEvent[];
  memories: Memory[];
  goals: Goal[];
};

const INITIAL: BubbleState = {
  connection: 'connecting',
  partnerOnline: false,
  moods: {},
  events: [],
  memories: [],
  goals: [],
};

/** Shared state of the couple's bubble; screens subscribe to the slices they need. */
export const useBubbleStore = create<BubbleState>()(() => INITIAL);

export type FrameListener = (frame: Record<string, unknown>) => void;

const byStart = (a: CalendarEvent, b: CalendarEvent) => a.startsAt.localeCompare(b.startsAt);

/**
 * The couple's live session: realtime connection, frame subscribers and the
 * actions screens call. Plain object (not React state), created once per couple.
 */
function createBubbleRuntime(data: BubbleData, me: string) {
  let connection: RealtimeConnection | null = null;
  let unsubscribeAlbum: (() => void) | null = null;
  const listeners = new Set<FrameListener>();
  const notify = (frame: Record<string, unknown>) => listeners.forEach((listen) => listen(frame));
  const send = (frame: Record<string, unknown>) => connection?.send(frame);

  const reloadTable = async (table: AlbumTable) => {
    try {
      if (table === 'events') useBubbleStore.setState({ events: [...(await data.listEvents())].sort(byStart) });
      if (table === 'memories') useBubbleStore.setState({ memories: await data.listMemories() });
      if (table === 'goals') useBubbleStore.setState({ goals: await data.listGoals() });
    } catch {
      // Keep what is shown; the next change or resync will try again.
    }
  };

  const reload = async () => {
    const moods = await data.listMoods().catch(() => null);
    if (moods) useBubbleStore.setState({ moods: Object.fromEntries(moods.map((m) => [m.userId, m])) });
    await Promise.all([reloadTable('events'), reloadTable('memories'), reloadTable('goals')]);
  };

  return {
    data,
    send,
    reload,

    /** Raw realtime frames, for the chat. */
    onFrame: (listener: FrameListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    start(partnerId: string | null) {
      useBubbleStore.setState(INITIAL, true);
      void reload();
      connection = data.connect({
        onStatus: (status) => useBubbleStore.setState({ connection: status }),
        onEvent: (event) => {
          switch (event.type) {
            case 'ready':
              useBubbleStore.setState({ partnerOnline: event.partnerOnline });
              break;
            case 'presence':
              if (event.userId === partnerId) useBubbleStore.setState({ partnerOnline: event.online });
              break;
            case 'mood':
              useBubbleStore.setState((state) => ({
                moods: { ...state.moods, [event.mood.userId]: event.mood },
              }));
              break;
            case 'resync':
              void reload();
              notify({ type: 'resync' });
              break;
            case 'frame':
              notify(event.frame);
              break;
            case 'error':
              if (__DEV__) console.warn('realtime error', event.code, event.message);
              break;
          }
        },
      });
      // Memories, projects and dates added by the partner appear live.
      unsubscribeAlbum = data.subscribeAlbum((table) => void reloadTable(table));
    },

    stop() {
      connection?.close();
      connection = null;
      unsubscribeAlbum?.();
      unsubscribeAlbum = null;
    },

    setMood(energy: number, mood: number) {
      useBubbleStore.setState((state) => ({
        moods: { ...state.moods, [me]: { userId: me, energy, mood, updatedAt: new Date().toISOString() } },
      }));
      send({ type: 'mood.set', energy, mood });
    },

    async addEvent(event: NewEvent) {
      const created = await data.addEvent(event);
      useBubbleStore.setState((state) => ({ events: [...state.events, created].sort(byStart) }));
    },

    async toggleFavorite(memory: Memory) {
      const favorite = !memory.isFavorite;
      const apply = (isFavorite: boolean) =>
        useBubbleStore.setState((state) => ({
          memories: state.memories.map((m) => (m.id === memory.id ? { ...m, isFavorite } : m)),
        }));
      apply(favorite);
      try {
        await data.setMemoryFavorite(memory.id, favorite);
      } catch {
        apply(!favorite);
      }
    },

    sendNote(text: string) {
      send({ type: 'message.send', id: randomUUID(), kind: 'text', body: text });
    },

    async deleteEvent(event: CalendarEvent) {
      useBubbleStore.setState((state) => ({ events: state.events.filter((e) => e.id !== event.id) }));
      await data.deleteEvent(event.id).catch(() => reloadTable('events'));
    },

    async addMemory(memory: NewMemory) {
      const created = await data.addMemory(memory);
      useBubbleStore.setState((state) => ({
        memories: [created, ...state.memories.filter((m) => m.id !== created.id)].sort(
          (a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt),
        ),
      }));
    },

    async deleteMemory(memory: Memory) {
      useBubbleStore.setState((state) => ({ memories: state.memories.filter((m) => m.id !== memory.id) }));
      await data.deleteMemory(memory).catch(() => reloadTable('memories'));
    },

    async addGoal(title: string) {
      const created = await data.addGoal(title);
      useBubbleStore.setState((state) => ({ goals: [...state.goals.filter((g) => g.id !== created.id), created] }));
    },

    async toggleGoal(goal: Goal) {
      const doneAt = goal.doneAt ? null : new Date().toISOString();
      const apply = (value: string | null) =>
        useBubbleStore.setState((state) => ({
          goals: state.goals.map((g) => (g.id === goal.id ? { ...g, doneAt: value } : g)),
        }));
      apply(doneAt);
      try {
        await data.setGoalDone(goal.id, doneAt !== null);
      } catch {
        apply(goal.doneAt);
      }
    },

    async deleteGoal(goal: Goal) {
      useBubbleStore.setState((state) => ({ goals: state.goals.filter((g) => g.id !== goal.id) }));
      await data.deleteGoal(goal.id).catch(() => reloadTable('goals'));
    },
  };
}

type BubbleValue = ReturnType<typeof createBubbleRuntime>;

const BubbleContext = createContext<BubbleValue | null>(null);

/** Opens the couple's bubble while the tabs are shown. */
export function BubbleProvider({ children }: PropsWithChildren) {
  const source = useSource();
  const { couple, partner } = useCouple();
  const coupleId = couple?.id ?? null;
  const partnerId = partner?.userId ?? null;

  const runtime = useMemo(
    () => (coupleId ? createBubbleRuntime(source.bubble(coupleId), source.me.id) : null),
    [source, coupleId],
  );

  useEffect(() => {
    if (!runtime) return;
    runtime.start(partnerId);
    return () => runtime.stop();
  }, [runtime, partnerId]);

  if (!runtime) return null;

  return <BubbleContext.Provider value={runtime}>{children}</BubbleContext.Provider>;
}

export function useBubble(): BubbleValue {
  const value = useContext(BubbleContext);
  if (!value) throw new Error('useBubble must be used inside <BubbleProvider>');
  return value;
}
