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

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
