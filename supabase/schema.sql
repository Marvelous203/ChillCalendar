create table events (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique
                   check (code ~ '^[2-9A-HJ-KM-NP-Z]{6,8}$'),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  note             text not null default '' check (char_length(note) <= 300),
  dates            text[] not null,
  hour_from        smallint not null check (hour_from between 0 and 23),
  hour_to          smallint not null check (hour_to between 1 and 24),
  visibility       text not null default 'link'
                   check (visibility in ('link', 'private')),
  finalize_policy  text not null default 'any_member'
                   check (finalize_policy in ('owner_only', 'any_member')),
  invite_token     text not null,
  final_date       text,
  final_from       smallint,
  final_to         smallint,
  final_place      uuid,
  finalized_by     text,
  finalized_at     timestamptz,
  live_from        timestamptz,
  ended_at         timestamptz,
  ended_by         text check (ended_by in ('owner', 'auto')),
  created_at       timestamptz not null default now(),
  check (hour_from < hour_to)
);

create table participants (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  token_hash  text not null,
  name        text not null check (char_length(name) between 1 and 40),
  status      text not null default 'approved' check (status in ('pending', 'approved', 'removed')),
  created_at  timestamptz not null default now(),
  unique (event_id, token_hash)
);

create table responses (
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  slots           text[] not null default '{}',
  updated_at      timestamptz not null default now(),
  primary key (event_id, participant_id)
);

create table places (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  type            text not null default 'single' check (type in ('single', 'itinerary')),
  name            text not null check (char_length(name) between 1 and 80),
  addr            text not null default '' check (char_length(addr) <= 160),
  link            text not null default '' check (char_length(link) <= 300),
  image_url       text not null default '' check (char_length(image_url) <= 500),
  note            text not null default '' check (char_length(note) <= 200),
  stops           jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create table votes (
  place_id        uuid not null references places(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  primary key (place_id, participant_id)
);

create table checkins (
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  checked_in_at   timestamptz not null default now(),
  left_at         timestamptz,
  note            text not null default '' check (char_length(note) <= 200),
  photo_url       text not null default '' check (char_length(photo_url) <= 500),
  primary key (event_id, participant_id)
);

create table live_moments (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  photo_url       text not null check (char_length(photo_url) between 1 and 500),
  caption         text not null default '' check (char_length(caption) <= 200),
  sticker         text not null default '' check (char_length(sticker) <= 16),
  pinned          boolean not null default false,
  created_at      timestamptz not null default now()
);

create table live_moment_reactions (
  moment_id       uuid not null references live_moments(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  emoji           text not null check (emoji in ('❤️', '😂', '🔥', '😮', '👏', '🎉')),
  created_at      timestamptz not null default now(),
  primary key (moment_id, participant_id, emoji)
);

create table app_stars (
  voter_key    text primary key,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

alter table events add foreign key (final_place) references places(id) on delete set null;

-- Bật RLS và không tạo policy: chỉ service_role ở server mới truy cập được
alter table events       enable row level security;
alter table participants enable row level security;
alter table responses    enable row level security;
alter table places       enable row level security;
alter table votes        enable row level security;
alter table checkins     enable row level security;
alter table live_moments enable row level security;
alter table live_moment_reactions enable row level security;
alter table app_stars enable row level security;

create index on events (owner_id);
create index on participants (event_id);
create index on responses (event_id);
create index on places (event_id);
create index on checkins (event_id, checked_in_at desc);
create index on live_moments (event_id, created_at desc);
create index on live_moment_reactions (moment_id);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
