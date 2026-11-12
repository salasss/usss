import { randomUUID } from 'expo-crypto';
import { useEffect } from 'react';
import { create } from 'zustand';

import { MESSAGES_PAGE, messageFromDto, type MessageDto } from '@/data/messages';
import type { MediaKind } from '@/data/source';
import type { Message } from '@/data/types';
import { useBubble } from '@/state/bubble';
import { useSource } from '@/state/data';

type ChatState = {
  /** Newest first. */
  messages: Message[];
  partnerTyping: boolean;
  loading: boolean;
  hasMore: boolean;
};

const INITIAL: ChatState = { messages: [], partnerTyping: false, loading: true, hasMore: true };

export const useChatStore = create<ChatState>()(() => INITIAL);

/** Without an echo from the server after this delay, a message is shown as failed. */
const SEND_TIMEOUT_MS = 15_000;
const TYPING_TIMEOUT_MS = 6_000;

const newestFirst = (a: Message, b: Message) => b.createdAt.localeCompare(a.createdAt);

/**
 * Merges one message. Rows read from the database are authoritative for
 * reactions and read receipts (they may have changed while offline); live
 * frames only add to what is known.
 */
function upsert(messages: Message[], incoming: Message, fromDatabase = false): Message[] {
  const index = messages.findIndex((m) => m.id === incoming.id);
  if (index < 0) return [incoming, ...messages].sort(newestFirst);
  const current = messages[index];
  const next = [...messages];
  next[index] = {
    ...incoming,
    reactions: fromDatabase ? incoming.reactions : { ...current.reactions, ...incoming.reactions },
    readAt: fromDatabase ? incoming.readAt : (incoming.readAt ?? current.readAt),
    localUri: incoming.localUri ?? current.localUri,
  };
  return next.sort(newestFirst);
}

/**
 * Applies the latest page from the database. When the page does not reach the
 * newest message already shown, messages were missed in between: older ones
 * are dropped (pagination brings them back) rather than leaving a hole.
 */
function mergeLatest(messages: Message[], page: Message[]): Pick<ChatState, 'messages' | 'hasMore'> {
  const full = page.length >= MESSAGES_PAGE;
  const oldestInPage = page[page.length - 1]?.createdAt;
  const newestShown = messages.find((m) => m.status === 'sent')?.createdAt;
  const gap = full && oldestInPage !== undefined && newestShown !== undefined && oldestInPage > newestShown;
  const base = gap ? messages.filter((m) => m.status !== 'sent') : messages;
  return {
    messages: page.reduce((list, message) => upsert(list, message, true), base),
    hasMore: full,
  };
}

function update(id: string, change: (message: Message) => Message) {
  useChatStore.setState((state) => ({
    messages: state.messages.map((m) => (m.id === id ? change(m) : m)),
  }));
}

/** Keeps the conversation in sync while the bubble is open (mounted with the tabs). */
export function ChatSync() {
  const { data, onFrame } = useBubble();
  const me = useSource().me.id;

  useEffect(() => {
    useChatStore.setState(INITIAL, true);
    let typingTimer: ReturnType<typeof setTimeout> | undefined;

    const loadLatest = () =>
      data
        .listMessages()
        .then((page) =>
          useChatStore.setState((state) => ({ ...mergeLatest(state.messages, page), loading: false })),
        )
        .catch(() => useChatStore.setState({ loading: false }));
    void loadLatest();

    const off = onFrame((frame) => {
      switch (frame.type) {
        case 'message.new': {
          const message = messageFromDto(frame.message as MessageDto);
          useChatStore.setState((state) => ({
            messages: upsert(state.messages, message),
            partnerTyping: message.senderId === me ? state.partnerTyping : false,
          }));
          break;
        }
        case 'message.read': {
          if (frame.reader_id === me) break;
          const until = String(frame.until);
          const readAt = new Date().toISOString();
          useChatStore.setState((state) => ({
            messages: state.messages.map((m) =>
              m.senderId === me && !m.readAt && m.createdAt <= until ? { ...m, readAt } : m,
            ),
          }));
          break;
        }
        case 'reaction': {
          const userId = String(frame.user_id);
          const emoji = typeof frame.emoji === 'string' ? frame.emoji : null;
          update(String(frame.message_id), (m) => {
            const reactions = { ...m.reactions };
            if (emoji) reactions[userId] = emoji;
            else delete reactions[userId];
            return { ...m, reactions };
          });
          break;
        }
        case 'typing': {
          if (frame.user_id === me) break;
          clearTimeout(typingTimer);
          useChatStore.setState({ partnerTyping: Boolean(frame.active) });
          if (frame.active) {
            typingTimer = setTimeout(() => useChatStore.setState({ partnerTyping: false }), TYPING_TIMEOUT_MS);
          }
          break;
        }
        case 'resync':
          void loadLatest();
          break;
      }
    });

    return () => {
      off();
      clearTimeout(typingTimer);
    };
  }, [data, onFrame, me]);

  return null;
}

/** Actions of the chat screen. */
export function useChatActions() {
  const { data, send } = useBubble();
  const me = useSource().me.id;

  const expectEcho = (id: string) =>
    setTimeout(() => update(id, (m) => (m.status === 'pending' ? { ...m, status: 'failed' } : m)), SEND_TIMEOUT_MS);

  const pending = (partial: Pick<Message, 'kind'> & Partial<Message>): Message => ({
    id: randomUUID(),
    senderId: me,
    body: null,
    mediaPath: null,
    durationMs: null,
    createdAt: new Date().toISOString(),
    readAt: null,
    reactions: {},
    status: 'pending',
    ...partial,
  });

  const transmit = (message: Message) => {
    send({
      type: 'message.send',
      id: message.id,
      kind: message.kind,
      body: message.body,
      media_path: message.mediaPath,
      duration_ms: message.durationMs,
    });
    expectEcho(message.id);
  };

  const uploadAndSend = async (message: Message, mimeType: string) => {
    try {
      const path = await data.uploadMedia(message.localUri as string, message.kind as MediaKind, mimeType);
      const ready = { ...message, mediaPath: path };
      update(message.id, () => ready);
      transmit(ready);
    } catch {
      update(message.id, (m) => ({ ...m, status: 'failed' }));
    }
  };

  return {
    sendText: (text: string) => {
      const message = pending({ kind: 'text', body: text });
      useChatStore.setState((state) => ({ messages: upsert(state.messages, message) }));
      transmit(message);
    },

    sendMedia: (kind: MediaKind, localUri: string, mimeType: string, durationMs?: number) => {
      const message = pending({ kind, localUri, durationMs: durationMs ?? null });
      useChatStore.setState((state) => ({ messages: upsert(state.messages, message) }));
      void uploadAndSend(message, mimeType);
    },

    retry: (message: Message) => {
      update(message.id, (m) => ({ ...m, status: 'pending' }));
      if (message.kind !== 'text' && !message.mediaPath && message.localUri) {
        void uploadAndSend(message, message.kind === 'voice' ? 'audio/mp4' : 'image/jpeg');
      } else {
        transmit(message);
      }
    },

    react: (message: Message, emoji: string) => {
      const current = message.reactions[me];
      if (current === emoji) {
        send({ type: 'reaction.clear', message_id: message.id });
      } else {
        send({ type: 'reaction.set', message_id: message.id, emoji });
      }
    },

    markRead: () => {
      const { messages } = useChatStore.getState();
      const unread = messages.filter((m) => m.senderId !== me && m.senderId !== null && !m.readAt);
      if (unread.length === 0) return;
      const until = unread[0].createdAt;
      send({ type: 'message.read', until });
      const readAt = new Date().toISOString();
      useChatStore.setState((state) => ({
        messages: state.messages.map((m) => (unread.includes(m) ? { ...m, readAt } : m)),
      }));
    },

    setTyping: (active: boolean) => send({ type: 'typing', active }),

    loadMore: async () => {
      const { messages, hasMore, loading } = useChatStore.getState();
      const oldest = messages[messages.length - 1];
      if (!hasMore || loading || !oldest) return;
      useChatStore.setState({ loading: true });
      try {
        const page = await data.listMessages(oldest.createdAt);
        useChatStore.setState((state) => ({
          messages: page.reduce((list, message) => upsert(list, message, true), state.messages),
          hasMore: page.length >= MESSAGES_PAGE,
          loading: false,
        }));
      } catch {
        useChatStore.setState({ loading: false });
      }
    },
  };
}

/** Messages from the partner not read yet (badge on the tab). */
export function useUnreadCount(me: string | undefined): number {
  return useChatStore((state) =>
    me ? state.messages.filter((m) => m.senderId !== null && m.senderId !== me && !m.readAt).length : 0,
  );
}
