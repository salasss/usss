import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { create } from 'zustand';

import type { ConnectionStatus, RealtimeConnection } from '@/data/realtime';
import type { BubbleData } from '@/data/source';
import type { CalendarEvent, Memory, Mood, NewEvent } from '@/data/types';
import { useCouple } from '@/state/couple';
import { useSource } from '@/state/data';

type BubbleState = {
  connection: ConnectionStatus;
  partnerOnline: boolean;
  moods: Record<string, Mood>;
  events: CalendarEvent[];
  memories: Memory[];
};

const INITIAL: BubbleState = {
  connection: 'connecting',
  partnerOnline: false,
  moods: {},
  events: [],
  memories: [],
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
  const listeners = new Set<FrameListener>();
  const notify = (frame: Record<string, unknown>) => listeners.forEach((listen) => listen(frame));
  const send = (frame: Record<string, unknown>) => connection?.send(frame);

  const reload = async () => {
    const [moods, events, memories] = await Promise.all([
      data.listMoods().catch(() => null),
      data.listEvents().catch(() => null),
      data.listMemories().catch(() => null),
    ]);
    useBubbleStore.setState((state) => ({
      moods: moods ? Object.fromEntries(moods.map((m) => [m.userId, m])) : state.moods,
      events: events ? [...events].sort(byStart) : state.events,
      memories: memories ?? state.memories,
    }));
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
    },

    stop() {
      connection?.close();
      connection = null;
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
