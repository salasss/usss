-- =============================================================================
-- usss · Private media storage
-- Photos and voice notes live in the private "couple-media" bucket, inside a
-- folder named after the couple: <couple_id>/<file>. Only the two members can
-- read, upload or delete files in their folder. Files are served through
-- short-lived signed URLs, never publicly.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'couple-media',
  'couple-media',
  false,
  26214400, -- 25 MiB
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "couple-media: members read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'couple-media'
    and (storage.foldername(name))[1] = (select private.current_couple_id())::text
  );

create policy "couple-media: members upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'couple-media'
    and (storage.foldername(name))[1] = (select private.current_couple_id())::text
  );

create policy "couple-media: members delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'couple-media'
    and (storage.foldername(name))[1] = (select private.current_couple_id())::text
  );
