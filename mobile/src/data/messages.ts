import type { Message, MessageKind } from '@/data/types';

/** Shape shared by the `messages` rows and the backend's `message.new` frames. */
export type MessageDto = {
  id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  duration_ms: number | null;
  created_at: string;
  read_at: string | null;
};

export type ReactionDto = { user_id: string; emoji: string };

export function messageFromDto(dto: MessageDto, reactions: ReactionDto[] = []): Message {
  return {
    id: dto.id,
    senderId: dto.sender_id,
    kind: dto.kind,
    body: dto.body,
    mediaPath: dto.media_path,
    durationMs: dto.duration_ms,
    createdAt: dto.created_at,
    readAt: dto.read_at,
    reactions: Object.fromEntries(reactions.map((r) => [r.user_id, r.emoji])),
    status: 'sent',
  };
}

export const MESSAGES_PAGE = 40;
