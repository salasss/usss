-- Push tokens: written by the backend only, invisible to the Data API.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'lea@example.com',    '{"full_name":"Léa"}'),
  ('22222222-2222-4222-8222-222222222222', 'thomas@example.com', '{"full_name":"Thomas"}');

-- ------------------------------------------------------------ as the backend --
select lives_ok(
  $$ insert into public.push_tokens (token, user_id)
     values ('lea-phone', '11111111-1111-4111-8111-111111111111') $$,
  'the backend stores the token of a phone');
select is(
  (select platform from public.push_tokens where token = 'lea-phone'),
  'android', 'phones are Android unless told otherwise');
select throws_ok(
  $$ insert into public.push_tokens (token, user_id)
     values ('lea-phone', '22222222-2222-4222-8222-222222222222') $$,
  '23505', null, 'a token belongs to a single person at a time');
select throws_ok(
  $$ insert into public.push_tokens (token, user_id)
     values ('', '11111111-1111-4111-8111-111111111111') $$,
  '23514', null, 'empty tokens are rejected');
select throws_ok(
  $$ insert into public.push_tokens (token, user_id)
     values ('ghost-phone', '99999999-9999-4999-8999-999999999999') $$,
  '23503', null, 'tokens belong to an existing profile');

-- ------------------------------------------------------- no Data API access --
select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass),
  'row level security is enabled');
select ok(
  not has_table_privilege('authenticated', 'public.push_tokens', 'select, insert, update, delete'),
  'signed-in requests have no privilege on push tokens');
select ok(
  not has_table_privilege('anon', 'public.push_tokens', 'select, insert, update, delete'),
  'anonymous requests have no privilege on push tokens');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$ select * from public.push_tokens $$,
  '42501', null, 'Léa cannot read push tokens, not even her own');
select throws_ok(
  $$ insert into public.push_tokens (token, user_id)
     values ('spy-phone', '22222222-2222-4222-8222-222222222222') $$,
  '42501', null, 'Léa cannot register a phone for Thomas');
select throws_ok(
  $$ delete from public.push_tokens $$,
  '42501', null, 'Léa cannot remove tokens directly');

set local role anon;
select throws_ok(
  $$ select * from public.push_tokens $$,
  '42501', null, 'anonymous requests cannot read push tokens');

-- ------------------------------------------------------------ account removal --
reset role;
select lives_ok(
  $$ delete from auth.users where id = '11111111-1111-4111-8111-111111111111' $$,
  'an account can be deleted');
select is(
  (select count(*)::int from public.push_tokens where token = 'lea-phone'),
  0, 'the tokens of a deleted account go with it');

select * from finish();
rollback;
