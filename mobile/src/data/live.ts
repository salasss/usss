import type { SupabaseClient } from '@supabase/supabase-js';

import { ApiError, createApi, type Api } from '@/data/api';
import { connectRealtime, moodFromDto, type RealtimeConnection } from '@/data/realtime';
import type { BubbleData, DataSource } from '@/data/source';
import type { CalendarEvent, Memory, MemoryCategory, EventColor } from '@/data/types';
import { env } from '@/lib/env';
import { requireSupabase } from '@/lib/supabase';
import type { Me } from '@/state/session';

export const MEDIA_BUCKET = 'couple-media';
const SIGNED_URL_TTL_S = 60 * 60;

type EventRow = { id: string; title: string; starts_at: string; color: EventColor; created_by: string | null };
type MemoryRow = {
  id: string;
  title: string;
  note: string | null;
  category: MemoryCategory;
  photo_path: string;
  taken_on: string;
  is_favorite: boolean;
  created_at: string;
  created_by: string | null;
};

const toEvent = (row: EventRow): CalendarEvent => ({
  id: row.id,
  title: row.title,
  startsAt: row.starts_at,
  color: row.color,
  createdBy: row.created_by,
});

const toMemory = (row: MemoryRow): Memory => ({
  id: row.id,
  title: row.title,
  note: row.note,
  category: row.category,
  photoPath: row.photo_path,
  takenOn: row.taken_on,
  isFavorite: row.is_favorite,
  createdAt: row.created_at,
  createdBy: row.created_by,
});

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Supabase (auth, data, storage) + usss backend (pairing, realtime). */
export function createLiveSource(me: Me): DataSource {
  const supabase = requireSupabase();
  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null;
  const api: Api | null = env.apiUrl ? createApi(env.apiUrl, getToken) : null;

  const backend = (): Api => {
    if (!api) throw new ApiError(0, 'not_configured', 'EXPO_PUBLIC_API_URL is missing');
    return api;
  };

  return {
    mode: 'live',
    me,
    getCouple: () => backend().getCouple(),
    createCouple: () => backend().createCouple(),
    joinCouple: (code) => backend().joinCouple(code),
    renewInvite: () => backend().renewInvite(),
    bubble: (coupleId) => liveBubble(supabase, api, me, coupleId),
  };
}

function liveBubble(supabase: SupabaseClient, api: Api | null, me: Me, coupleId: string): BubbleData {
  const signed = new Map<string, { url: string; expiresAt: number }>();

  return {
    async listMoods() {
      const { data, error } = await supabase.from('moods').select('user_id, energy, mood, updated_at');
      fail(error);
      return (data ?? []).map(moodFromDto);
    },

    async listEvents() {
      const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('id, title, starts_at, color, created_by')
        .gte('starts_at', since)
        .order('starts_at')
        .limit(50);
      fail(error);
      return (data ?? []).map(toEvent);
    },

    async addEvent(event) {
      const { data, error } = await supabase
        .from('events')
        .insert({
          couple_id: coupleId,
          created_by: me.id,
          title: event.title,
          starts_at: event.startsAt,
          color: event.color,
        })
        .select('id, title, starts_at, color, created_by')
        .single();
      fail(error);
      return toEvent(data as EventRow);
    },

    async listMemories() {
      const { data, error } = await supabase
        .from('memories')
        .select('id, title, note, category, photo_path, taken_on, is_favorite, created_at, created_by')
        .order('taken_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300);
      fail(error);
      return (data ?? []).map(toMemory);
    },

    async setMemoryFavorite(id, favorite) {
      const { error } = await supabase.from('memories').update({ is_favorite: favorite }).eq('id', id);
      fail(error);
    },

    async mediaUrl(path) {
      const cached = signed.get(path);
      if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
      const { data, error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_S);
      if (error || !data) return null;
      signed.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_S * 1000 });
      return data.signedUrl;
    },

    connect(listener): RealtimeConnection {
      if (!api) {
        // Without the backend there is no realtime channel.
        listener.onStatus('closed');
        return { send: () => undefined, close: () => undefined };
      }
      const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null;
      return connectRealtime(api.socketUrl(), getToken, listener);
    },
  };
}
