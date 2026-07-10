-- ============================================================
--  GPL Online — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Rooms table
create table if not exists public.rooms (
  id           text        primary key,
  name         text        not null,
  creator_name text        not null default '',
  celebrants   jsonb       not null default '[]',
  created_at   timestamptz not null default now()
);

-- Enable pg_cron extension for auto-cleanup (Requires turning on in Supabase Extensions)
create extension if not exists pg_cron;

-- 1.5 Legacy Cleanup Removal
-- We used to have a pg_cron job and trigger here, but they are blocked by Supabase's new storage rules.
-- Run these commands to remove them from your database:
select cron.unschedule('cleanup_expired_rooms');
drop trigger if exists cleanup_room_storage_trigger on public.rooms;
drop function if exists public.cleanup_room_storage;

-- 2. Persistent Leaderboard table
create table if not exists public.room_hits (
  room_id  text not null references public.rooms(id) on delete cascade,
  user_id  text not null,
  name     text not null,
  hits     int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- 3. Global stats table (optional, for landing page counters)
create table if not exists public.global_stats (
  id               int  primary key default 1,
  total_sessions   int  not null default 0,
  total_hits       int  not null default 0,
  updated_at       timestamptz default now()
);

-- Insert initial row
insert into public.global_stats (id, total_sessions, total_hits)
values (1, 0, 0)
on conflict (id) do nothing;

-- Helper RPC for incrementing sessions
create or replace function public.increment_sessions()
returns void
language sql
security definer
as $$
  update public.global_stats
  set total_sessions = total_sessions + 1,
      updated_at     = now()
  where id = 1;
$$;

-- ============================================================
--  Row Level Security (RLS)
-- ============================================================

-- Rooms: anyone can read and insert (no auth required)
alter table public.rooms enable row level security;

drop policy if exists "rooms_read"   on public.rooms;
drop policy if exists "rooms_insert" on public.rooms;

create policy "rooms_read"
  on public.rooms for select
  using (true);

create policy "rooms_insert"
  on public.rooms for insert
  with check (true);

create policy "rooms_delete"
  on public.rooms for delete
  using (true);

-- Room Hits: anyone can read and upsert
alter table public.room_hits enable row level security;

drop policy if exists "room_hits_read"   on public.room_hits;
drop policy if exists "room_hits_insert" on public.room_hits;
drop policy if exists "room_hits_update" on public.room_hits;

create policy "room_hits_read"
  on public.room_hits for select
  using (true);

create policy "room_hits_insert"
  on public.room_hits for insert
  with check (true);

create policy "room_hits_update"
  on public.room_hits for update
  using (true);

-- Global stats: anyone can read
alter table public.global_stats enable row level security;

drop policy if exists "stats_read" on public.global_stats;

create policy "stats_read"
  on public.global_stats for select
  using (true);

-- ============================================================
--  Storage Bucket: celebrant-photos
--  Create this in: Storage → New bucket → "celebrant-photos"
--  Then set the policy below in Storage → Policies
-- ============================================================

-- Storage policy (run in SQL Editor):
-- Allow anyone to read photos (public bucket)
-- Allow anyone to upload image files up to 5MB

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'celebrant-photos',
  'celebrant-photos',
  true,                           -- public bucket (no auth needed to view)
  5242880,                        -- 5MB max file size
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage RLS policies
drop policy if exists "Public photos read" on storage.objects;
create policy "Public photos read"
  on storage.objects for select
  using ( bucket_id = 'celebrant-photos' );

drop policy if exists "Anyone can upload photos" on storage.objects;
create policy "Anyone can upload photos"
  on storage.objects for insert
  with check (
    bucket_id = 'celebrant-photos'
    and (storage.foldername(name))[1] = 'rooms'
  );

drop policy if exists "Anyone can delete photos" on storage.objects;
create policy "Anyone can delete photos"
  on storage.objects for delete
  using ( bucket_id = 'celebrant-photos' );

-- ============================================================
--  Enable Realtime for the rooms table (optional)
--  Realtime Broadcast doesn't need this — but good to have
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
END $$;
