import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import type { Mood } from '@/data/types';

/** Events of the realtime channel, normalized for the app. */
export type RealtimeEvent =
  | { type: 'ready'; partnerOnline: boolean }
  | { type: 'presence'; userId: string; online: boolean }
  | { type: 'mood'; mood: Mood }
  | { type: 'resync' }
  | { type: 'error'; code: string; message: string }
  /** Raw frames other features handle (messages, typing...). */
  | { type: 'frame'; frame: Record<string, unknown> };

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export type RealtimeListener = {
  onEvent: (event: RealtimeEvent) => void;
  onStatus: (status: ConnectionStatus) => void;
};

export type RealtimeConnection = {
  /** Sends a frame now, or as soon as the connection is back. */
  send: (frame: Record<string, unknown>) => void;
  close: () => void;
};

type MoodDto = { user_id: string; energy: number; mood: number; updated_at: string };

export function moodFromDto(dto: MoodDto): Mood {
  return { userId: dto.user_id, energy: dto.energy, mood: dto.mood, updatedAt: dto.updated_at };
}

function normalize(frame: Record<string, unknown>): RealtimeEvent {
  switch (frame.type) {
    case 'ready':
      return { type: 'ready', partnerOnline: Boolean(frame.partner_online) };
    case 'presence':
      return { type: 'presence', userId: String(frame.user_id), online: Boolean(frame.online) };
    case 'mood':
      return { type: 'mood', mood: moodFromDto(frame.mood as MoodDto) };
    case 'resync':
      return { type: 'resync' };
    case 'error':
      return { type: 'error', code: String(frame.code), message: String(frame.message) };
    default:
      return { type: 'frame', frame };
  }
}

const MAX_BACKOFF_MS = 30_000;
const MAX_QUEUE = 100;

/** React Native's WebSocket accepts headers for the upgrade request (not in the DOM typings). */
type NativeWebSocket = new (
  url: string,
  protocols: string | string[] | null,
  options: { headers: Record<string, string> },
) => WebSocket;

/**
 * WebSocket to the usss backend: reconnects with backoff, pauses in the
 * background and replays queued frames once connected again.
 */
export function connectRealtime(
  url: string,
  getToken: () => Promise<string | null>,
  listener: RealtimeListener,
): RealtimeConnection {
  let socket: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const queue: string[] = [];

  const schedule = () => {
    if (closed || timer) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
    attempt += 1;
    timer = setTimeout(() => {
      timer = null;
      void open();
    }, delay);
  };

  const open = async () => {
    if (closed || socket) return;
    listener.onStatus('connecting');
    const token = await getToken().catch(() => null);
    if (closed) return;
    if (!token) {
      listener.onStatus('closed');
      schedule();
      return;
    }

    // The token travels in a header, never in the URL (proxies log URLs).
    const ws = new (WebSocket as unknown as NativeWebSocket)(url, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    socket = ws;

    ws.onopen = () => {
      attempt = 0;
      listener.onStatus('open');
      while (queue.length > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(queue.shift() as string);
      }
    };
    ws.onmessage = (message) => {
      try {
        listener.onEvent(normalize(JSON.parse(String(message.data)) as Record<string, unknown>));
      } catch {
        // Ignore frames that are not JSON.
      }
    };
    ws.onclose = () => {
      if (socket === ws) socket = null;
      listener.onStatus('closed');
      schedule();
    };
    ws.onerror = () => {
      // onclose follows and schedules the reconnection.
    };
  };

  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') {
      attempt = 0;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void open();
    } else if (state === 'background') {
      socket?.close();
    }
  };
  const subscription: NativeEventSubscription = AppState.addEventListener('change', onAppState);

  void open();

  return {
    send: (frame) => {
      const json = JSON.stringify(frame);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(json);
      } else if (queue.length < MAX_QUEUE) {
        queue.push(json);
      }
    },
    close: () => {
      closed = true;
      subscription.remove();
      if (timer) clearTimeout(timer);
      socket?.close();
      socket = null;
      listener.onStatus('closed');
    },
  };
}
