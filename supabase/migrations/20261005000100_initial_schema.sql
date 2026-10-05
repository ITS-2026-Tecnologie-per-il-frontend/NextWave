-- Vibe Pulse: schema iniziale. Solo operazioni additive; nessun DROP/reset remoto.
create schema if not exists vp_private;
revoke all on schema vp_private from public, anon, authenticated;

create table public.genres (
  name text primary key check (length(name) between 1 and 40),
  display_order smallint not null unique
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Ascoltatore' check (length(trim(display_name)) between 1 and 35),
  theme text not null default 'pulse' check (theme in ('pulse', 'trap', 'house', 'pop', 'jazz')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  genre text not null references public.genres(name),
  primary key (user_id, genre)
);
create table vp_private.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 70),
  demo_key text unique,
  spotify_id text unique check (spotify_id ~ '^[A-Za-z0-9]{22}$'),
  monthly_listeners integer check (monthly_listeners between 0 and 9999),
  eligibility_verified_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table vp_private.tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references vp_private.artists(id),
  title text not null check (length(trim(title)) between 1 and 100),
  genre text not null references public.genres(name),
  mood text not null default 'Sognante',
  language text not null default 'Italiano',
  audio_path text not null check (audio_path ~ '^/audio/[0-4]\.wav$' or audio_path ~ '^https://'),
  duration_seconds double precision not null check (duration_seconds > 0 and duration_seconds <= 1800),
  spotify_id text unique check (spotify_id ~ '^[A-Za-z0-9]{22}$'),
  demo_key text unique,
  rights_verified_at timestamptz,
  active boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (not active or is_demo or rights_verified_at is not null)
);
create index tracks_genre_active_idx on vp_private.tracks(genre) where active;
create table vp_private.contests (
  day date primary key,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (closes_at = (day + time '21:00') at time zone 'Europe/Rome')
);
create table vp_private.daily_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null references vp_private.contests(day),
  slot smallint not null check (slot between 1 and 5),
  track_id uuid not null references vp_private.tracks(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, day, slot),
  unique(user_id, day, track_id),
  unique(user_id, day, id)
);
create index selections_track_day_idx on vp_private.daily_selections(track_id, day);
create table vp_private.listening_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  selection_id uuid not null,
  credited_seconds double precision not null default 0 check (credited_seconds >= 0),
  last_position double precision not null default 0 check (last_position >= 0),
  last_ping_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  completed_at timestamptz,
  unique(user_id),
  foreign key(user_id, day, selection_id) references vp_private.daily_selections(user_id, day, id) on delete cascade
);
create table vp_private.votes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  selection_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id, day),
  foreign key(user_id, day, selection_id) references vp_private.daily_selections(user_id, day, id) on delete cascade
);
create index votes_selection_idx on vp_private.votes(selection_id);
create table vp_private.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id uuid not null references vp_private.tracks(id),
  created_at timestamptz not null default now(),
  primary key(user_id, track_id)
);
create table public.artist_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  artist text not null check (length(trim(artist)) between 1 and 70),
  title text not null check (length(trim(title)) between 1 and 100),
  listeners integer not null check (listeners between 0 and 9999),
  genre text not null references public.genres(name),
  language text not null check (length(language) between 1 and 40),
  subgenre text not null check (length(trim(subgenre)) between 1 and 60),
  mood text not null check (length(mood) between 1 and 40),
  spotify_id text not null check (spotify_id ~ '^[A-Za-z0-9]{22}$'),
  rights_confirmed boolean not null check (rights_confirmed),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique(user_id, spotify_id)
);
create index applications_user_created_idx on public.artist_applications(user_id, created_at desc);
create table vp_private.reveal_views (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null references vp_private.contests(day),
  seen_at timestamptz not null default now(),
  primary key(user_id, day)
);

-- RLS anche sulle tabelle private: difesa aggiuntiva alle ACL/schema non esposto.
alter table public.genres enable row level security;
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.artist_applications enable row level security;
alter table vp_private.artists enable row level security;
alter table vp_private.tracks enable row level security;
alter table vp_private.contests enable row level security;
alter table vp_private.daily_selections enable row level security;
alter table vp_private.listening_sessions enable row level security;
alter table vp_private.votes enable row level security;
alter table vp_private.favorites enable row level security;
alter table vp_private.reveal_views enable row level security;

revoke all on public.genres, public.profiles, public.user_preferences, public.artist_applications from anon, authenticated;
revoke all on all tables in schema vp_private from public, anon, authenticated;
grant select on public.genres to anon, authenticated;
grant select on public.profiles, public.user_preferences, public.artist_applications to authenticated;
create policy genres_read on public.genres for select to anon, authenticated using (true);
create policy profile_read_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy preferences_read_own on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy applications_read_own on public.artist_applications for select to authenticated using ((select auth.uid()) = user_id);

-- I record di profilo vengono creati per ogni utente Auth, anche preesistente.
create function vp_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id) on conflict (id) do nothing;
  insert into public.user_preferences(user_id, genre)
  select new.id, g.name from public.genres g where g.name in ('Indie', 'Pop', 'Elettronica')
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function vp_private.handle_new_user() from public, anon, authenticated;
create trigger vp_auth_user_created after insert on auth.users
for each row execute function vp_private.handle_new_user();

comment on schema vp_private is 'Dati contest non esposti via Data API; accesso solo attraverso RPC con auth.uid e orario server.';
