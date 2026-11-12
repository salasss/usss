import { ApiError, createApi, type Api } from '@/data/api';
import type { DataSource } from '@/data/source';
import { env } from '@/lib/env';
import { requireSupabase } from '@/lib/supabase';
import type { Me } from '@/state/session';

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
  };
}
