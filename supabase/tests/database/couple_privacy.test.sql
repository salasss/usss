-- Row Level Security: each couple only ever sees and changes its own data.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- ---------------------------------------------------------------- fixtures --
-- Léa & Thomas (couple A), Sam & Alex (couple B), Solo (not paired).
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'lea@example.com',    '{"full_name":"Léa"}'),
  ('22222222-2222-4222-8222-222222222222', 'thomas@example.com', '{"full_name":"Thomas"}'),
  ('33333333-3333-4333-8333-333333333333', 'sam@example.com',    '{"full_name":"Sam"}'),
  ('44444444-4444-4444-8444-444444444444', 'alex@example.com',   '{"full_name":"Alex"}'),
  ('55555555-5555-4555-8555-555555555555', 'solo@example.com',   '{"full_name":"Solo"}');

insert into public.couples (id, created_by, invite_code, invite_expires_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', null, null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', null, null);

insert into public.couple_members (couple_id, user_id, seat) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 2),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 1),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 2);

insert into public.messages (id, couple_id, sender_id, kind, body) values
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'text', 'On se fait quoi ce soir ?'),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'text', 'Ce que tu veux !'),
  ('dddddddd-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'text', 'Secret de B');

insert into public.moods (user_id, couple_id, energy, mood) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 70, 80),
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 40, 90),
  ('33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 50, 50);

insert into public.memories (couple_id, created_by, title, category, photo_path) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Road trip', 'trip', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/road.jpg'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'Privé', 'night', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.jpg');

insert into public.events (couple_id, created_by, title, starts_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'Week-end', now() + interval '3 days'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'Dîner', now() + interval '1 day');

insert into storage.objects (bucket_id, name) values
  ('couple-media', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/road.jpg'),
  ('couple-media', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/b.jpg');

-- ------------------------------------------------------------------ as Léa --
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 2, 'Léa sees her profile and Thomas''s');
select is((select count(*)::int from public.profiles where display_name = 'Sam'), 0, 'Léa cannot see other couples'' profiles');
select is((select count(*)::int from public.couples), 1, 'Léa sees only her couple');
select is((select count(*)::int from public.couple_members), 2, 'Léa sees the two members of her couple');
select is((select count(*)::int from public.messages), 2, 'Léa reads the messages of her couple');
select is((select count(*)::int from public.messages where body = 'Secret de B'), 0, 'Léa cannot read another couple''s messages');

select lives_ok(
  $$ insert into public.messages (couple_id, sender_id, kind, body)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'text', 'Je t''aime') $$,
  'Léa sends a message to Thomas');
select throws_ok(
  $$ insert into public.messages (couple_id, sender_id, kind, body)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'text', 'Usurpation') $$,
  '42501', null, 'Léa cannot send a message as Thomas');
select throws_ok(
  $$ insert into public.messages (couple_id, sender_id, kind, body)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'text', 'Intrusion') $$,
  '42501', null, 'Léa cannot post in another couple');
select throws_ok(
  $$ update public.messages set body = 'modifié' where id = 'dddddddd-0000-4000-8000-000000000001' $$,
  '42501', null, 'messages cannot be rewritten');
select results_eq(
  $$ with u as (update public.messages set read_at = now()
                where id = 'dddddddd-0000-4000-8000-000000000001' returning 1)
     select count(*)::int from u $$,
  array[1], 'Léa marks Thomas''s message as read');
select results_eq(
  $$ with u as (update public.messages set read_at = now()
                where id = 'dddddddd-0000-4000-8000-000000000002' returning 1)
     select count(*)::int from u $$,
  array[0], 'Léa cannot mark her own message as read');
select results_eq(
  $$ with d as (delete from public.messages
                where id = 'dddddddd-0000-4000-8000-000000000001' returning 1)
     select count(*)::int from d $$,
  array[0], 'Léa cannot delete Thomas''s message');

select throws_ok(
  $$ insert into public.couples (created_by) values ('11111111-1111-4111-8111-111111111111') $$,
  '42501', null, 'couples are only created by the backend');
select throws_ok(
  $$ insert into public.couple_members (couple_id, user_id, seat)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 1) $$,
  '42501', null, 'nobody joins a couple without the backend');
select throws_ok(
  $$ update public.couples set invite_code = 'K7PQ2MXZ', invite_expires_at = now()
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'invite codes are managed by the backend');
select results_eq(
  $$ with u as (update public.couples set together_since = '2023-02-14'
                where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1)
     select count(*)::int from u $$,
  array[1], 'partners set their anniversary');

select is((select count(*)::int from public.moods), 2, 'Léa sees both moods of her couple');
select results_eq(
  $$ with u as (update public.moods set energy = 0
                where user_id = '22222222-2222-4222-8222-222222222222' returning 1)
     select count(*)::int from u $$,
  array[0], 'Léa cannot change Thomas''s mood');
select lives_ok(
  $$ update public.moods set energy = 95 where user_id = '11111111-1111-4111-8111-111111111111' $$,
  'Léa updates her own mood');

select is((select count(*)::int from public.memories), 1, 'Léa sees only her couple''s memories');
select lives_ok(
  $$ insert into public.memories (couple_id, created_by, title, photo_path)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111',
             'Pique-nique', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/picnic.jpg') $$,
  'Léa adds a memory');
select throws_ok(
  $$ insert into public.memories (couple_id, created_by, photo_path)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'x.jpg') $$,
  '42501', null, 'Léa cannot add a memory to another couple');
select is((select count(*)::int from public.events), 1, 'Léa sees only her couple''s calendar');

select lives_ok(
  $$ insert into public.message_reactions (message_id, user_id, emoji)
     values ('dddddddd-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '❤️') $$,
  'Léa reacts to Thomas''s message');
select throws_ok(
  $$ insert into public.message_reactions (message_id, user_id, emoji)
     values ('dddddddd-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '😂') $$,
  '42501', null, 'Léa cannot react to another couple''s message');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'couple-media'),
  1, 'Léa only lists her couple''s media');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('couple-media', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/voice.m4a') $$,
  'Léa uploads into her couple''s folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('couple-media', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/spy.jpg') $$,
  '42501', null, 'Léa cannot upload into another couple''s folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('couple-media', 'loose.jpg') $$,
  '42501', null, 'files outside a couple folder are refused');

-- ------------------------------------------------------------------ as Solo --
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'someone unpaired only sees their own profile');
select is((select count(*)::int from public.messages), 0, 'someone unpaired reads no message');
select throws_ok(
  $$ insert into public.messages (couple_id, sender_id, kind, body)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'text', 'Hello') $$,
  '42501', null, 'someone unpaired cannot post anywhere');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'couple-media'),
  0, 'someone unpaired sees no media');

-- ---------------------------------------------------------------- as anon --
set local role anon;
select throws_ok($$ select * from public.messages $$, '42501', null, 'anonymous requests cannot read messages');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonymous requests cannot read profiles');

reset role;
select * from finish();
rollback;
