-- =============================================================================
-- usss · Push notification tokens
-- One row per phone that accepts notifications: its Firebase Cloud Messaging
-- registration token and the person signed in on it. A token belongs to one
-- person at a time: when someone else signs in on the same phone, the backend
-- hands the token over. Only the backend (connected as postgres) reads and
-- writes this table; the app registers through POST /devices, never through
-- the Data API.
-- =============================================================================

create table public.push_tokens (
  token      text primary key
             check (char_length(token) between 1 and 4096),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null default 'android',
  updated_at timestamptz not null default now()
);

comment on table public.push_tokens is
  'FCM registration tokens of the phones of each person, managed by the backend only.';

-- Tokens of the partner, looked up for every message sent while they are away.
create index push_tokens_user_id_idx on public.push_tokens (user_id);

-- RLS on and no policy, no privilege: neither anonymous nor signed-in
-- requests reach the table (Supabase grants new tables to the API roles).
alter table public.push_tokens enable row level security;
revoke all on table public.push_tokens from anon, authenticated;
