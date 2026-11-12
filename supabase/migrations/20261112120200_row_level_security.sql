-- =============================================================================
-- usss · Row Level Security
-- Everything belongs to a couple and only its two members can reach it.
-- Pairing (couples, couple_members) is written by the backend only.
-- Anonymous requests get nothing at all.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: couple of the caller. Lives in a schema the Data API does not
-- expose; security definer so policies can read couple_members without
-- recursing into its own policies.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cm.couple_id
  from public.couple_members as cm
  where cm.user_id = (select auth.uid())
$$;

comment on function private.current_couple_id() is
  'Couple of the authenticated caller, or null when not paired.';

revoke all on function private.current_couple_id() from public;
grant execute on function private.current_couple_id() to authenticated;

-- -----------------------------------------------------------------------------
-- Table privileges
-- -----------------------------------------------------------------------------
revoke all on table
  public.profiles, public.couples, public.couple_members,
  public.messages, public.message_reactions,
  public.memories, public.goals, public.events, public.moods
from anon;

-- Profiles are created by the auth trigger; only display fields can change.
revoke insert, update, delete on table public.profiles from authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

-- Pairing goes through the backend; partners may only set their anniversary.
revoke insert, update, delete on table public.couples, public.couple_members from authenticated;
grant update (together_since) on table public.couples to authenticated;

-- Messages are immutable, except for the read receipt.
revoke update on table public.messages from authenticated;
grant update (read_at) on table public.messages to authenticated;

-- -----------------------------------------------------------------------------
-- profiles: yourself and your partner
-- -----------------------------------------------------------------------------
create policy "profiles: read own and partner"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select cm.user_id
      from public.couple_members as cm
      where cm.couple_id = (select private.current_couple_id())
    )
  );

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- couples / couple_members: visible to the two members
-- -----------------------------------------------------------------------------
create policy "couples: members read"
  on public.couples for select to authenticated
  using (id = (select private.current_couple_id()));

create policy "couples: members update"
  on public.couples for update to authenticated
  using (id = (select private.current_couple_id()))
  with check (id = (select private.current_couple_id()));

create policy "couple_members: members read"
  on public.couple_members for select to authenticated
  using (couple_id = (select private.current_couple_id()));

-- -----------------------------------------------------------------------------
-- messages and reactions
-- -----------------------------------------------------------------------------
create policy "messages: members read"
  on public.messages for select to authenticated
  using (couple_id = (select private.current_couple_id()));

create policy "messages: send as yourself"
  on public.messages for insert to authenticated
  with check (
    couple_id = (select private.current_couple_id())
    and sender_id = (select auth.uid())
  );

create policy "messages: recipient marks as read"
  on public.messages for update to authenticated
  using (
    couple_id = (select private.current_couple_id())
    and sender_id is distinct from (select auth.uid())
  )
  with check (couple_id = (select private.current_couple_id()));

create policy "messages: sender deletes own"
  on public.messages for delete to authenticated
  using (
    couple_id = (select private.current_couple_id())
    and sender_id = (select auth.uid())
  );

create policy "message_reactions: members read"
  on public.message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.messages as m
      where m.id = message_id
        and m.couple_id = (select private.current_couple_id())
    )
  );

create policy "message_reactions: react as yourself"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages as m
      where m.id = message_id
        and m.couple_id = (select private.current_couple_id())
    )
  );

create policy "message_reactions: change own"
  on public.message_reactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "message_reactions: remove own"
  on public.message_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- memories, goals, events: shared, editable by both partners
-- -----------------------------------------------------------------------------
create policy "memories: members read"
  on public.memories for select to authenticated
  using (couple_id = (select private.current_couple_id()));
create policy "memories: members add"
  on public.memories for insert to authenticated
  with check (
    couple_id = (select private.current_couple_id())
    and created_by = (select auth.uid())
  );
create policy "memories: members edit"
  on public.memories for update to authenticated
  using (couple_id = (select private.current_couple_id()))
  with check (couple_id = (select private.current_couple_id()));
create policy "memories: members delete"
  on public.memories for delete to authenticated
  using (couple_id = (select private.current_couple_id()));

create policy "goals: members read"
  on public.goals for select to authenticated
  using (couple_id = (select private.current_couple_id()));
create policy "goals: members add"
  on public.goals for insert to authenticated
  with check (
    couple_id = (select private.current_couple_id())
    and created_by = (select auth.uid())
  );
create policy "goals: members edit"
  on public.goals for update to authenticated
  using (couple_id = (select private.current_couple_id()))
  with check (couple_id = (select private.current_couple_id()));
create policy "goals: members delete"
  on public.goals for delete to authenticated
  using (couple_id = (select private.current_couple_id()));

create policy "events: members read"
  on public.events for select to authenticated
  using (couple_id = (select private.current_couple_id()));
create policy "events: members add"
  on public.events for insert to authenticated
  with check (
    couple_id = (select private.current_couple_id())
    and created_by = (select auth.uid())
  );
create policy "events: members edit"
  on public.events for update to authenticated
  using (couple_id = (select private.current_couple_id()))
  with check (couple_id = (select private.current_couple_id()));
create policy "events: members delete"
  on public.events for delete to authenticated
  using (couple_id = (select private.current_couple_id()));

-- -----------------------------------------------------------------------------
-- moods: both can read, each writes their own
-- -----------------------------------------------------------------------------
create policy "moods: members read"
  on public.moods for select to authenticated
  using (couple_id = (select private.current_couple_id()));

create policy "moods: share your own"
  on public.moods for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and couple_id = (select private.current_couple_id())
  );

create policy "moods: update your own"
  on public.moods for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and couple_id = (select private.current_couple_id())
  );

-- -----------------------------------------------------------------------------
-- Realtime: changes are pushed to subscribers, filtered by the policies above.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.messages, public.message_reactions, public.moods,
      public.memories, public.goals, public.events;
  end if;
end;
$$;
