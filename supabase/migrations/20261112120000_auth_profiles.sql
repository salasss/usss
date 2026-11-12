-- =============================================================================
-- usss · Auth schema
-- Every Google account that signs in gets a public profile, created by a
-- trigger on auth.users. Profiles are locked down (RLS on, no policy yet):
-- access rules are added with the couple privacy policies.
-- =============================================================================

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default ''
               check (char_length(display_name) <= 60),
  avatar_url   text
               check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile of a signed-in user, one row per auth.users row.';

alter table public.profiles enable row level security;

-- -----------------------------------------------------------------------------
-- updated_at bookkeeping, reused by the other tables
-- -----------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Profile bootstrap from the Google identity (name + picture)
-- -----------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        nullif(new.raw_user_meta_data ->> 'name', ''),
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      60
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Only the auth trigger may run it.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
