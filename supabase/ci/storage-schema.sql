-- Minimal stand-in for the Supabase Storage schema, for CI runs on the bare
-- supabase/postgres image (the real schema is created by the Storage service).
-- Mirrors the objects the migrations rely on; never applied to a real project.
-- Run as supabase_admin: the image ships an empty storage schema it owns.
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  owner_id         text,
  metadata         jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end;
$$;

grant usage on schema storage to postgres, anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

-- Migrations run as postgres and create policies on storage.objects, which
-- requires ownership (granted through the platform on hosted projects).
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
