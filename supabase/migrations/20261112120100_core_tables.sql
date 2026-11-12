-- =============================================================================
-- usss · Core tables
--
--   profiles ──< couple_members >── couples
--                     │                ├──< messages ──< message_reactions
--                     │                ├──< memories
--                     │                ├──< goals
--                     │                └──< events
--                     └──< moods (one current mood per person)
--
-- A couple has at most two members, enforced by constraints alone: each
-- membership takes seat 1 or 2, a seat is unique per couple and a person
-- belongs to a single couple. Authors (senders, mood owners, creators) are
-- tied to a real membership through composite foreign keys, so nobody can
-- write on behalf of a couple they are not part of, backend included.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Couples
-- -----------------------------------------------------------------------------
create table public.couples (
  id                uuid primary key default gen_random_uuid(),
  created_by        uuid references public.profiles (id) on delete set null,
  -- Code shared with the partner: 8 characters without look-alikes (0/O, 1/I).
  -- Cleared once the couple is complete.
  invite_code       text unique
                    check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  invite_expires_at timestamptz,
  together_since    date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint couples_invite_complete
    check ((invite_code is null) = (invite_expires_at is null))
);

comment on table public.couples is 'A private space shared by exactly two people.';

create trigger couples_touch_updated_at
  before update on public.couples
  for each row execute function public.touch_updated_at();

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  seat      smallint not null check (seat in (1, 2)),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  constraint couple_members_one_couple_per_user unique (user_id),
  constraint couple_members_two_seats unique (couple_id, seat)
);

comment on table public.couple_members is
  'Membership of a couple: two seats per couple, one couple per person.';

-- -----------------------------------------------------------------------------
-- Messages ("Notre bulle")
-- -----------------------------------------------------------------------------
create type public.message_kind as enum ('text', 'image', 'voice');

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  sender_id   uuid,
  kind        public.message_kind not null default 'text',
  body        text check (char_length(body) <= 4000),
  -- Path in the private "couple-media" storage bucket: <couple_id>/<file>
  media_path  text check (char_length(media_path) <= 512),
  duration_ms integer check (duration_ms between 0 and 600000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  foreign key (couple_id, sender_id)
    references public.couple_members (couple_id, user_id)
    on delete set null (sender_id),
  constraint messages_payload check (
    case kind
      when 'text'  then body is not null and btrim(body) <> '' and media_path is null
      when 'image' then media_path is not null
      when 'voice' then media_path is not null and duration_ms is not null
    end
  )
);

create index messages_couple_created_at_idx
  on public.messages (couple_id, created_at desc);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Memories ("Nos souvenirs")
-- -----------------------------------------------------------------------------
create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  created_by  uuid,
  title       text not null default '' check (char_length(title) <= 80),
  note        text check (char_length(note) <= 1000),
  category    text not null default 'simple'
              check (category in ('trip', 'night', 'date', 'simple')),
  photo_path  text not null check (char_length(photo_path) <= 512),
  taken_on    date not null default current_date,
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  foreign key (couple_id, created_by)
    references public.couple_members (couple_id, user_id)
    on delete set null (created_by)
);

create index memories_couple_taken_on_idx
  on public.memories (couple_id, taken_on desc, created_at desc);

-- -----------------------------------------------------------------------------
-- Shared goals ("Nos projets") and calendar ("Agenda partagé")
-- -----------------------------------------------------------------------------
create table public.goals (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  created_by uuid,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  foreign key (couple_id, created_by)
    references public.couple_members (couple_id, user_id)
    on delete set null (created_by)
);

create index goals_couple_created_at_idx on public.goals (couple_id, created_at);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  created_by uuid,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  starts_at  timestamptz not null,
  color      text not null default 'peach'
             check (color in ('peach', 'rose', 'lilac', 'butter', 'mint')),
  created_at timestamptz not null default now(),
  foreign key (couple_id, created_by)
    references public.couple_members (couple_id, user_id)
    on delete set null (created_by)
);

create index events_couple_starts_at_idx on public.events (couple_id, starts_at);

-- -----------------------------------------------------------------------------
-- Moods ("Notre humeur"): the current state of each partner
-- -----------------------------------------------------------------------------
create table public.moods (
  user_id    uuid primary key,
  couple_id  uuid not null,
  energy     smallint not null default 50 check (energy between 0 and 100),
  mood       smallint not null default 50 check (mood between 0 and 100),
  updated_at timestamptz not null default now(),
  foreign key (couple_id, user_id)
    references public.couple_members (couple_id, user_id)
    on delete cascade
);

create trigger moods_touch_updated_at
  before update on public.moods
  for each row execute function public.touch_updated_at();

-- Locked until the privacy policies are defined.
alter table public.couples           enable row level security;
alter table public.couple_members    enable row level security;
alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;
alter table public.memories          enable row level security;
alter table public.goals             enable row level security;
alter table public.events            enable row level security;
alter table public.moods             enable row level security;
