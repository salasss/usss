import type { RealtimeConnection, RealtimeListener } from '@/data/realtime';
import type {
  CalendarEvent,
  Couple,
  Goal,
  Memory,
  Message,
  Mood,
  NewEvent,
  NewMemory,
} from '@/data/types';
import type { Me } from '@/state/session';

export type MediaKind = 'image' | 'voice';

export type AlbumTable = 'memories' | 'goals' | 'events';

/** Data of one couple, available once both partners are in. */
export interface BubbleData {
  /** Newest first; `before` pages back in time. */
  listMessages(before?: string): Promise<Message[]>;
  /** Uploads a local file into the couple's private folder, returns its path. */
  uploadMedia(localUri: string, kind: MediaKind, mimeType: string): Promise<string>;
  listMoods(): Promise<Mood[]>;
  listEvents(): Promise<CalendarEvent[]>;
  addEvent(event: NewEvent): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;
  listMemories(): Promise<Memory[]>;
  addMemory(memory: NewMemory): Promise<Memory>;
  deleteMemory(memory: Memory): Promise<void>;
  setMemoryFavorite(id: string, favorite: boolean): Promise<void>;
  listGoals(): Promise<Goal[]>;
  addGoal(title: string): Promise<Goal>;
  setGoalDone(id: string, done: boolean): Promise<void>;
  deleteGoal(id: string): Promise<void>;
  /** Changes made by the partner on the album tables (Supabase Realtime). */
  subscribeAlbum(onChange: (table: AlbumTable) => void): () => void;
  /** Displayable URL of a stored media (short-lived signed URL), or null. */
  mediaUrl(path: string): Promise<string | null>;
  /** Realtime channel shared with the partner. */
  connect(listener: RealtimeListener): RealtimeConnection;
}

/**
 * Everything the screens need from the outside world. Two implementations:
 * `live` (Supabase + usss backend) and `demo` (local sample data, used when
 * the build has no Supabase configuration).
 */
export interface DataSource {
  readonly mode: 'live' | 'demo';
  readonly me: Me;

  getCouple(): Promise<Couple | null>;
  createCouple(): Promise<Couple>;
  joinCouple(code: string): Promise<Couple>;
  renewInvite(): Promise<Couple>;
  /** Push notifications: registers or removes the FCM token of this phone. */
  registerDevice(token: string): Promise<void>;
  unregisterDevice(token: string): Promise<void>;

  bubble(coupleId: string): BubbleData;
}
