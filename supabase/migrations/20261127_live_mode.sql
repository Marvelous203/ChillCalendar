-- Migration: Chế độ "Đang diễn ra" (Live Mode) & Check-in
-- Chạy script này trong Supabase SQL Editor nếu DB đã được khởi tạo trước đó.

alter table events
  add column if not exists live_from timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by text check (ended_by in ('owner', 'auto'));

create table if not exists checkins (
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  checked_in_at   timestamptz not null default now(),
  left_at         timestamptz,
  note            text not null default '' check (char_length(note) <= 200),
  photo_url       text not null default '' check (char_length(photo_url) <= 500),
  primary key (event_id, participant_id)
);

alter table checkins enable row level security;
create index if not exists checkins_event_checked_idx on checkins (event_id, checked_in_at desc);

create table if not exists live_moments (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  photo_url       text not null check (char_length(photo_url) between 1 and 500),
  caption         text not null default '' check (char_length(caption) <= 200),
  created_at      timestamptz not null default now()
);

alter table live_moments
  add column if not exists sticker text not null default '',
  add column if not exists pinned boolean not null default false;

create table if not exists live_moment_reactions (
  moment_id       uuid not null references live_moments(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  emoji           text not null check (emoji in ('❤️', '😂', '🔥', '😮', '👏', '🎉')),
  created_at      timestamptz not null default now(),
  primary key (moment_id, participant_id, emoji)
);

alter table live_moments enable row level security;
alter table live_moment_reactions enable row level security;
create index if not exists live_moments_event_created_idx on live_moments (event_id, created_at desc);
create index if not exists live_moment_reactions_moment_idx on live_moment_reactions (moment_id);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
