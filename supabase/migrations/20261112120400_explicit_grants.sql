-- =============================================================================
-- usss · Explicit table privileges
-- Supabase grants new tables of "public" to the API roles by default, but a
-- project can switch that off. Grant exactly what the app relies on; Row
-- Level Security still decides which rows are reachable, and the privileges
-- revoked earlier (pairing tables, rewriting messages) stay revoked.
-- =============================================================================

grant usage on schema public to authenticated;

grant select on table public.profiles, public.couples, public.couple_members to authenticated;

-- Column-level UPDATE grants (read_at, display fields, anniversary) were
-- given with the policies; messages stay immutable otherwise.
grant select, insert, delete on table public.messages to authenticated;

grant select, insert, update, delete on table
  public.message_reactions,
  public.memories,
  public.goals,
  public.events,
  public.moods
to authenticated;
