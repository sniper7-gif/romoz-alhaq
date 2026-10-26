-- Romoz Al-Haq: schema, RLS, realtime and storage. Idempotent.
create extension if not exists pgcrypto;

create table if not exists public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  user_codename text not null unique,
  role text not null check (role in ('ADMIN','MEMBER')),
  last_seen timestamptz not null default now(),
  public_key text
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_codename text not null,
  role text not null check (role in ('ADMIN','MEMBER')),
  cipher_text text,
  iv text,
  audio_url text,
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  user_codename text not null unique,
  role text not null check (role in ('ADMIN','MEMBER')),
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  updated_at timestamptz not null default now()
);

-- Strict RLS: no policy for anon/authenticated => deny all direct access.
-- All access flows through the Next.js API (service key) after JWT verification.
alter table public.active_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.locations enable row level security;
revoke all on public.active_sessions, public.messages, public.locations from anon, authenticated;

-- Private storage bucket for encrypted voice blobs (no public policies).
insert into storage.buckets (id, name, public, file_size_limit)
values ('voice-messages', 'voice-messages', false, 10485760)
on conflict (id) do update set public = false;
