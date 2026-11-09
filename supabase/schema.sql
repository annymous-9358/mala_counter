-- Mala Counter database schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- Also enable anonymous sign-ins: Dashboard → Authentication → Sign In / Providers → "Allow anonymous sign-ins".

-- Past malas (history)
create table if not exists public.sessions (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mantra_id    text,
  mantra_name  text,
  image_id     text,
  target       integer,            -- null = free count (no limit)
  count        integer not null,
  duration_ms  bigint  not null default 0,
  mode         text    not null default 'tap',  -- tap | bell | both
  started_at   timestamptz not null,
  ended_at     timestamptz not null,
  created_at   timestamptz not null default now()
);
create index if not exists sessions_user_ended_idx on public.sessions (user_id, ended_at desc);

-- User's own mantras
create table if not exists public.mantras (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  text        text not null default '',
  goal        integer,              -- default target for this mantra, null = free
  updated_at  timestamptz not null default now()
);

-- User's uploaded images (files live in the "mala-images" storage bucket)
create table if not exists public.images (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path        text not null,        -- <user_id>/<id>.jpg inside the bucket
  url         text not null,
  created_at  timestamptz not null default now()
);

-- Row level security: every user only sees and changes their own rows
alter table public.sessions enable row level security;
alter table public.mantras  enable row level security;
alter table public.images   enable row level security;

drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own mantras" on public.mantras;
create policy "own mantras" on public.mantras
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own images" on public.images;
create policy "own images" on public.images
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage bucket for images. Public read (so <img src> works), writes only into your own folder.
insert into storage.buckets (id, name, public)
values ('mala-images', 'mala-images', true)
on conflict (id) do nothing;

drop policy if exists "mala images upload own folder" on storage.objects;
create policy "mala images upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mala-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "mala images delete own folder" on storage.objects;
create policy "mala images delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'mala-images' and (storage.foldername(name))[1] = auth.uid()::text);
