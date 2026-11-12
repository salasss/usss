import type { RealtimeConnection, RealtimeListener } from '@/data/realtime';
import type { CalendarEvent, Couple, Memory, Mood, NewEvent } from '@/data/types';
import type { Me } from '@/state/session';

/** Data of one couple, available once both partners are in. */
export interface BubbleData {
  listMoods(): Promise<Mood[]>;
  listEvents(): Promise<CalendarEvent[]>;
  addEvent(event: NewEvent): Promise<CalendarEvent>;
  listMemories(): Promise<Memory[]>;
  setMemoryFavorite(id: string, favorite: boolean): Promise<void>;
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

  bubble(coupleId: string): BubbleData;
}
