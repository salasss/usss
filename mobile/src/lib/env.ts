/**
 * Public build-time configuration. Expo inlines `process.env.EXPO_PUBLIC_*`
 * when bundling, so each variable must be referenced with a static name.
 */
function read(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const env = {
  supabaseUrl: read(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: read(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  googleWebClientId: read(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  /** usss backend (pairing and realtime), e.g. https://usss-api.example.com */
  apiUrl: read(process.env.EXPO_PUBLIC_API_URL)?.replace(/\/+$/, '') ?? null,
} as const;

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const isGoogleConfigured = isSupabaseConfigured && Boolean(env.googleWebClientId);
