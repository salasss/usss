import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { ApiError, createApi, type Api } from '@/data/api';
import { MESSAGES_PAGE, messageFromDto, type MessageDto, type ReactionDto } from '@/data/messages';
import { connectRealtime, moodFromDto, type RealtimeConnection } from '@/data/realtime';
import type { AlbumTable, BubbleData, DataSource } from '@/data/source';
import type { CalendarEvent, EventColor, Goal, Memory, MemoryCategory } from '@/data/types';
import { env } from '@/lib/env';
import { requireSupabase } from '@/lib/supabase';
import type { Me } from '@/state/session';

export const MEDIA_BUCKET = 'couple-media';
const SIGNED_URL_TTL_S = 60 * 60;

const EVENT_COLUMNS = 'id, title, starts_at, color, created_by';
const MEMORY_COLUMNS = 'id, title, note, category, photo_path, taken_on, is_favorite, created_at, created_by';
const GOAL_COLUMNS = 'id, title, done_at, created_at, created_by';

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
type GoalRow = { id: string; title: string; done_at: string | null; created_at: string; created_by: string | null };

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

const toGoal = (row: GoalRow): Goal => ({
  id: row.id,
  title: row.title,
  doneAt: row.done_at,
  createdAt: row.created_at,
  createdBy: row.created_by,
});

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function extensionOf(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType.startsWith('audio/')) return 'm4a';
  return 'jpg';
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
  const media = () => supabase.storage.from(MEDIA_BUCKET);

  /** Uploads into the couple's folder: required by the storage policies and the backend. */
  const upload = async (localUri: string, folder: string, mimeType: string) => {
    const path = `${coupleId}/${folder}/${randomUUID()}.${extensionOf(mimeType)}`;
    const body = await (await fetch(localUri)).arrayBuffer();
    const { error } = await media().upload(path, body, { contentType: mimeType, upsert: false });
    fail(error);
    return path;
  };

  return {
    async listMessages(before) {
      let query = supabase
        .from('messages')
        .select(
          'id, sender_id, kind, body, media_path, duration_ms, created_at, read_at, message_reactions(user_id, emoji)',
        )
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PAGE);
      if (before) query = query.lt('created_at', before);
      const { data, error } = await query;
      fail(error);
      type Row = MessageDto & { message_reactions: ReactionDto[] | null };
      return ((data ?? []) as Row[]).map((row) => messageFromDto(row, row.message_reactions ?? []));
    },

    uploadMedia: (localUri, kind, mimeType) => upload(localUri, kind, mimeType),

    async listMoods() {
      const { data, error } = await supabase.from('moods').select('user_id, energy, mood, updated_at');
      fail(error);
      return (data ?? []).map(moodFromDto);
    },

    async listEvents() {
      const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_COLUMNS)
        .gte('starts_at', since)
        .order('starts_at')
        .limit(50);
      fail(error);
      return ((data ?? []) as EventRow[]).map(toEvent);
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
        .select(EVENT_COLUMNS)
        .single();
      fail(error);
      return toEvent(data as EventRow);
    },

    async deleteEvent(id) {
      const { error } = await supabase.from('events').delete().eq('id', id);
      fail(error);
    },

    async listMemories() {
      const { data, error } = await supabase
        .from('memories')
        .select(MEMORY_COLUMNS)
        .order('taken_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300);
      fail(error);
      return ((data ?? []) as MemoryRow[]).map(toMemory);
    },

    async addMemory(memory) {
      const path = await upload(memory.localUri, 'memories', memory.mimeType);
      const { data, error } = await supabase
        .from('memories')
        .insert({
          couple_id: coupleId,
          created_by: me.id,
          title: memory.title,
          category: memory.category,
          photo_path: path,
          taken_on: memory.takenOn,
        })
        .select(MEMORY_COLUMNS)
        .single();
      if (error) {
        await media().remove([path]);
        throw new Error(error.message);
      }
      return toMemory(data as MemoryRow);
    },

    async deleteMemory(memory) {
      const { error } = await supabase.from('memories').delete().eq('id', memory.id);
      fail(error);
      await media().remove([memory.photoPath]);
    },

    async setMemoryFavorite(id, favorite) {
      const { error } = await supabase.from('memories').update({ is_favorite: favorite }).eq('id', id);
      fail(error);
    },

    async listGoals() {
      const { data, error } = await supabase.from('goals').select(GOAL_COLUMNS).order('created_at');
      fail(error);
      return ((data ?? []) as GoalRow[]).map(toGoal);
    },

    async addGoal(title) {
      const { data, error } = await supabase
        .from('goals')
        .insert({ couple_id: coupleId, created_by: me.id, title })
        .select(GOAL_COLUMNS)
        .single();
      fail(error);
      return toGoal(data as GoalRow);
    },

    async setGoalDone(id, done) {
      const { error } = await supabase
        .from('goals')
        .update({ done_at: done ? new Date().toISOString() : null })
        .eq('id', id);
      fail(error);
    },

    async deleteGoal(id) {
      const { error } = await supabase.from('goals').delete().eq('id', id);
      fail(error);
    },

    subscribeAlbum(onChange) {
      const channel = supabase.channel(`album:${coupleId}`);
      for (const table of ['memories', 'goals', 'events'] as AlbumTable[]) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` },
          () => onChange(table),
        );
      }
      channel.subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },

    async mediaUrl(path) {
      const cached = signed.get(path);
      if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;
      const { data, error } = await media().createSignedUrl(path, SIGNED_URL_TTL_S);
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
