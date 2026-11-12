-- Structural guarantees of the couple schema (run with `supabase test db`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- People: Léa and Thomas form a couple, Sam is someone else.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'lea@example.com',    '{"full_name":"Léa"}'),
  ('22222222-2222-4222-8222-222222222222', 'thomas@example.com', '{"full_name":"Thomas"}'),
  ('33333333-3333-4333-8333-333333333333', 'sam@example.com',    '{"full_name":"Sam"}');

insert into public.couples (id, created_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333');

insert into public.couple_members (couple_id, user_id, seat) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 1),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 2);

-- ---------------------------------------------------------------- two seats --
select throws_ok(
  $$ insert into public.couple_members (couple_id, user_id, seat)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 3) $$,
  '23514', null, 'there is no third seat in a couple');

select throws_ok(
  $$ insert into public.couple_members (couple_id, user_id, seat)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 2) $$,
  '23505', null, 'a taken seat cannot be given to someone else');

select throws_ok(
  $$ insert into public.couple_members (couple_id, user_id, seat)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 1) $$,
  '23505', null, 'a person belongs to a single couple');

select lives_ok(
  $$ insert into public.couple_members (couple_id, user_id, seat)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 1) $$,
  'someone single can take a free seat elsewhere');

-- ------------------------------------------------------------- invitations --
select lives_ok(
  $$ update public.couples
     set invite_code = 'K7PQ2MXZ', invite_expires_at = now() + interval '1 day'
     where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'a well-formed invite code is accepted');

select throws_ok(
  $$ update public.couples set invite_code = 'ABCD0OI1', invite_expires_at = now()
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', null, 'look-alike characters are rejected in invite codes');

select throws_ok(
  $$ update public.couples set invite_code = 'K7PQ2MXA', invite_expires_at = null
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23514', null, 'an invite code always has an expiry');

select throws_ok(
  $$ update public.couples set invite_code = 'K7PQ2MXZ', invite_expires_at = now()
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23505', null, 'invite codes are unique');

-- ---------------------------------------------------------------- messages --
select lives_ok(
  $$ insert into public.messages (id, couple_id, sender_id, kind, body)
     values ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
             '22222222-2222-4222-8222-222222222222', 'text', 'On se fait quoi ce soir ?') $$,
  'a member can post a text message');

select throws_ok(
  $$ insert into public.messages (couple_id, sender_id, kind, body)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'text', '   ') $$,
  '23514', null, 'blank text messages are rejected');

select throws_ok(
  $$ insert into public.messages (couple_id, sender_id, kind, media_path)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'voice', 'a/voice.m4a') $$,
  '23514', null, 'voice messages need a duration');

select throws_ok(
  $$ insert into public.messages (couple_id, sender_id, kind, body)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'text', 'Coucou') $$,
  '23503', null, 'someone outside the couple cannot be the sender');

-- ------------------------------------------------------------------- moods --
select lives_ok(
  $$ insert into public.moods (user_id, couple_id, energy, mood)
     values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 80, 65) $$,
  'a member shares a mood');

select throws_ok(
  $$ insert into public.moods (user_id, couple_id)
     values ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '23503', null, 'no mood in a couple you are not part of');

select throws_ok(
  $$ update public.moods set energy = 101 where user_id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null, 'moods stay between 0 and 100');

-- ---------------------------------------------------------------- memories --
select throws_ok(
  $$ insert into public.memories (couple_id, created_by, category, photo_path)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'party', 'a/p.jpg') $$,
  '23514', null, 'memory categories are fixed');

-- ------------------------------------------------------- leaving a couple --
delete from public.couple_members where user_id = '22222222-2222-4222-8222-222222222222';

select is(
  (select sender_id from public.messages where id = 'dddddddd-0000-4000-8000-000000000001'),
  null, 'messages stay when their author leaves, without an author');

select is(
  (select count(*)::int from public.couple_members where couple_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1, 'the other partner keeps the couple');

delete from public.couples where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select count(*)::int from public.messages where couple_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0, 'deleting a couple deletes its messages');

select is(
  (select count(*)::int from public.moods where couple_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0, 'deleting a couple deletes its moods');

select * from finish();
rollback;
