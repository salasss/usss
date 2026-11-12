import { randomUUID } from 'expo-crypto';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
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

type BubbleValue = {
  data: BubbleData;
  /** Raw realtime frames, for the chat. */
  onFrame: (listener: FrameListener) => () => void;
  send: (frame: Record<string, unknown>) => void;
  setMood: (energy: number, mood: number) => void;
  addEvent: (event: NewEvent) => Promise<void>;
  toggleFavorite: (memory: Memory) => Promise<void>;
  sendNote: (text: string) => void;
  reload: () => Promise<void>;
};

const BubbleContext = createContext<BubbleValue | null>(null);

const byStart = (a: CalendarEvent, b: CalendarEvent) => a.startsAt.localeCompare(b.startsAt);

export function BubbleProvider({ children }: PropsWithChildren) {
  const source = useSource();
  const { couple, partner } = useCouple();
  const coupleId = couple?.id ?? null;
  const partnerId = partner?.userId ?? null;
  const data = useMemo(() => (coupleId ? source.bubble(coupleId) : null), [source, coupleId]);
  const connection = useRef<RealtimeConnection | null>(null);
  const listeners = useRef(new Set<FrameListener>());

  const reload = useCallback(async () => {
    if (!data) return;
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
  }, [data]);

  useEffect(() => {
    if (!data) return;
    useBubbleStore.setState(INITIAL, true);
    void reload();

    const notify = (frame: Record<string, unknown>) => listeners.current.forEach((listen) => listen(frame));
    const conn = data.connect({
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
    connection.current = conn;
    return () => {
      conn.close();
      connection.current = null;
    };
  }, [data, partnerId, reload]);

  if (!data) return null;

  const send = (frame: Record<string, unknown>) => connection.current?.send(frame);

  const value: BubbleValue = {
    data,
    send,
    reload,
    onFrame: (listener) => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    },
    setMood: (energy, mood) => {
      const me = source.me.id;
      useBubbleStore.setState((state) => ({
        moods: { ...state.moods, [me]: { userId: me, energy, mood, updatedAt: new Date().toISOString() } },
      }));
      send({ type: 'mood.set', energy, mood });
    },
    addEvent: async (event) => {
      const created = await data.addEvent(event);
      useBubbleStore.setState((state) => ({ events: [...state.events, created].sort(byStart) }));
    },
    toggleFavorite: async (memory) => {
      const favorite = !memory.isFavorite;
      const apply = (value: boolean) =>
        useBubbleStore.setState((state) => ({
          memories: state.memories.map((m) => (m.id === memory.id ? { ...m, isFavorite: value } : m)),
        }));
      apply(favorite);
      try {
        await data.setMemoryFavorite(memory.id, favorite);
      } catch {
        apply(!favorite);
      }
    },
    sendNote: (text) => {
      send({ type: 'message.send', id: randomUUID(), kind: 'text', body: text });
    },
  };

  return <BubbleContext.Provider value={value}>{children}</BubbleContext.Provider>;
}

export function useBubble(): BubbleValue {
  const value = useContext(BubbleContext);
  if (!value) throw new Error('useBubble must be used inside <BubbleProvider>');
  return value;
}
