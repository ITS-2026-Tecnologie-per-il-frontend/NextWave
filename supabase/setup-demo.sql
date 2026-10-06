-- Eseguire UNA VOLTA nel SQL Editor del progetto Supabase vuoto.
-- Migrazioni atomiche e storico CLI: niente reset/drop, niente chiavi segrete.
-- INCLUDE IL CATALOGO DEMO, non dati di produzione.
begin;
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

-- Dati di riferimento reali e stabili. Nessun account/voto fittizio.
insert into public.genres(name, display_order) values
('Indie', 1), ('Pop', 2), ('Hip hop', 3), ('Elettronica', 4), ('R&B', 5),
('Trap', 6), ('Rap', 7), ('Drill', 8), ('Rock', 9), ('Dance', 10),
('House', 11), ('Techno', 12), ('Reggaeton', 13), ('Afrobeat', 14), ('Jazz', 15)
on conflict (name) do nothing;
insert into public.profiles(id) select id from auth.users on conflict do nothing;
insert into public.user_preferences(user_id, genre)
select p.id, g.name from public.profiles p cross join public.genres g
where g.name in ('Indie', 'Pop', 'Elettronica')
  and not exists (select 1 from public.user_preferences up where up.user_id = p.id)
on conflict do nothing;

-- Le RPC sono SECURITY DEFINER per raggiungere il ledger privato, ma ogni percorso
-- verifica auth.uid(). search_path vuoto e riferimenti qualificati evitano shadowing.
create function vp_private.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Accesso richiesto.' using errcode = '42501'; end if;
  return v_uid;
end;
$$;
revoke all on function vp_private.require_user() from public, anon, authenticated;

create function public.save_profile(p_name text, p_theme text, p_genres text[], p_onboarded boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := vp_private.require_user();
begin
  if p_genres is null or cardinality(p_genres) < 1 or cardinality(p_genres) > 15
     or exists (select 1 from unnest(p_genres) genre where genre is null or not exists (select 1 from public.genres g where g.name = genre))
  then raise exception 'Scegli almeno un genere valido.'; end if;
  update public.profiles set display_name = trim(p_name), theme = p_theme,
    onboarded = p_onboarded, updated_at = clock_timestamp() where id = v_uid;
  if not found then raise exception 'Profilo non disponibile.'; end if;
  delete from public.user_preferences where user_id = v_uid;
  insert into public.user_preferences(user_id, genre) select v_uid, distinct_genre from (select distinct unnest(p_genres) as distinct_genre) preferences;
end;
$$;

create function vp_private.ensure_daily_selection(p_uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (clock_timestamp() at time zone 'Europe/Rome')::date;
  v_count integer;
  v_onboarded boolean;
begin
  -- Serializza richieste simultanee dello stesso utente e cambi di preferenze.
  select onboarded into v_onboarded from public.profiles where id = p_uid for update;
  if not v_onboarded then return; end if;
  if exists(select 1 from vp_private.daily_selections where user_id = p_uid and day = v_day) then return; end if;
  select count(*) into v_count from vp_private.tracks t
    join vp_private.artists a on a.id = t.artist_id
    join public.user_preferences p on p.genre = t.genre and p.user_id = p_uid
    where t.active and (a.is_demo or a.eligibility_verified_at is not null) and a.monthly_listeners < 10000;
  if v_count < 5 then return; end if;
  insert into vp_private.contests(day, closes_at)
    values(v_day, (v_day + time '21:00') at time zone 'Europe/Rome') on conflict do nothing;
  with candidates as (
    select t.id, -ln(greatest(random(), 0.000000001)) * (1 + (select count(*) from vp_private.daily_selections s where s.track_id = t.id)) as weight
    from vp_private.tracks t join vp_private.artists a on a.id = t.artist_id
    join public.user_preferences p on p.genre = t.genre and p.user_id = p_uid
    where t.active and (a.is_demo or a.eligibility_verified_at is not null) and a.monthly_listeners < 10000
  ), chosen as (select id, weight from candidates order by weight limit 5)
  insert into vp_private.daily_selections(user_id, day, slot, track_id)
    select p_uid, v_day, row_number() over(order by weight)::smallint, id from chosen;
end;
$$;
revoke all on function vp_private.ensure_daily_selection(uuid) from public, anon, authenticated;

create function public.get_dashboard() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'Europe/Rome')::date;
  v_profile jsonb;
  v_rounds jsonb;
  v_tracks jsonb;
  v_favorites jsonb;
begin
  perform vp_private.ensure_daily_selection(v_uid);
  select jsonb_build_object('uid', p.id, 'name', p.display_name, 'theme', p.theme,
    'onboard', p.onboarded, 'connected', false,
    'prefs', coalesce((select jsonb_agg(up.genre order by g.display_order) from public.user_preferences up join public.genres g on g.name = up.genre where up.user_id = v_uid), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'artist', a.artist, 'title', a.title, 'listeners', a.listeners, 'genre', a.genre, 'language', a.language, 'subgenre', a.subgenre, 'mood', a.mood, 'status', a.status, 'spotify', 'https://open.spotify.com/track/' || a.spotify_id, 'created', a.created_at) order by a.created_at desc) from public.artist_applications a where a.user_id = v_uid), '[]'::jsonb),
    'seenReveals', coalesce((select jsonb_agg(rv.day::text) from vp_private.reveal_views rv where rv.user_id = v_uid), '[]'::jsonb)
  ) into v_profile from public.profiles p where p.id = v_uid;
  if v_profile is null then raise exception 'Profilo non disponibile.'; end if;
  select coalesce(jsonb_object_agg(day::text, payload), '{}'::jsonb) into v_rounds from (
    select s.day, jsonb_build_object('day', s.day::text,
      'ids', jsonb_agg(s.id order by s.slot),
      'listened', coalesce(jsonb_agg(s.id order by s.slot) filter(where s.completed_at is not null), '[]'::jsonb),
      'vote', (select v.selection_id from vp_private.votes v where v.user_id = v_uid and v.day = s.day),
      'completionVersion', 2) payload
    from vp_private.daily_selections s where s.user_id = v_uid group by s.day
  ) rounds;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'genre', t.genre, 'mood', t.mood,
    'lang', t.language, 'duration', t.duration_seconds, 'isDemo', t.is_demo,
    'title', case when v_now >= c.closes_at then t.title else null end,
    'artist', case when v_now >= c.closes_at then a.name else null end,
    'spotifyUrl', case when v_now >= c.closes_at and t.spotify_id is not null then 'https://open.spotify.com/track/' || t.spotify_id else null end,
    'saved', exists(select 1 from vp_private.favorites f where f.user_id = v_uid and f.track_id = t.id)
  ) order by s.day, s.slot), '[]'::jsonb) into v_tracks
  from vp_private.daily_selections s join vp_private.contests c on c.day = s.day
  join vp_private.tracks t on t.id = s.track_id join vp_private.artists a on a.id = t.artist_id
  where s.user_id = v_uid;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'artist', a.name, 'genre', t.genre) order by f.created_at desc), '[]'::jsonb) into v_favorites
  from vp_private.favorites f join vp_private.tracks t on t.id = f.track_id join vp_private.artists a on a.id = t.artist_id where f.user_id = v_uid;
  return jsonb_build_object('profile', v_profile || jsonb_build_object('rounds', v_rounds, 'saved', (select coalesce(jsonb_agg(item->'id'), '[]'::jsonb) from jsonb_array_elements(v_favorites) item)),
    'tracks', v_tracks, 'favorites', v_favorites,
    'clock', jsonb_build_object('day', v_day::text, 'seconds', extract(hour from v_now at time zone 'Europe/Rome') * 3600 + extract(minute from v_now at time zone 'Europe/Rome') * 60 + extract(second from v_now at time zone 'Europe/Rome'),
      'revealed', v_now >= (v_day + time '21:00') at time zone 'Europe/Rome'), 'serverTime', v_now);
end;
$$;

create function public.begin_listening(p_selection uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_day date := (clock_timestamp() at time zone 'Europe/Rome')::date;
  v_selection vp_private.daily_selections%rowtype;
  v_session uuid;
  v_audio text;
  v_duration double precision;
begin
  perform 1 from public.profiles where id = v_uid for update;
  select * into v_selection from vp_private.daily_selections where id = p_selection and user_id = v_uid and day = v_day;
  if not found then raise exception 'Brano non disponibile per oggi.'; end if;
  if exists(select 1 from vp_private.daily_selections where user_id = v_uid and day = v_day and slot < v_selection.slot and completed_at is null)
  then raise exception 'Completa il brano precedente.'; end if;
  select audio_path, duration_seconds into v_audio, v_duration from vp_private.tracks where id = v_selection.track_id;
  delete from vp_private.listening_sessions where user_id = v_uid;
  insert into vp_private.listening_sessions(user_id, day, selection_id) values(v_uid, v_day, p_selection) returning id into v_session;
  return jsonb_build_object('sessionId', v_session, 'audioUrl', v_audio, 'duration', v_duration);
end;
$$;

create function public.listening_progress(p_session uuid, p_position double precision, p_finish boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_now timestamptz := clock_timestamp();
  v_session vp_private.listening_sessions%rowtype;
  v_duration double precision;
  v_delta double precision;
  v_elapsed double precision;
  v_credit double precision;
begin
  select * into v_session from vp_private.listening_sessions where id = p_session and user_id = v_uid for update;
  if not found or v_session.day <> (v_now at time zone 'Europe/Rome')::date or v_session.expires_at <= v_now
  then raise exception 'Sessione scaduta. Riavvia il brano.'; end if;
  if v_session.completed_at is not null then return jsonb_build_object('completed', true); end if;
  select t.duration_seconds into v_duration from vp_private.daily_selections s join vp_private.tracks t on t.id = s.track_id where s.id = v_session.selection_id;
  if p_position is null or not (p_position >= 0 and p_position <= v_duration + 0.25) then raise exception 'Posizione audio non valida.'; end if;
  v_delta := p_position - v_session.last_position;
  v_elapsed := greatest(0, extract(epoch from v_now - v_session.last_ping_at));
  if v_delta < -0.1 or v_delta > v_elapsed + 0.75 then raise exception 'Ascolto discontinuo. Riavvia il brano.'; end if;
  -- I heartbeat ogni ~3 s danno credito solo all'avanzamento e al tempo server,
  -- mai a una singola dichiarazione di completamento. Il tetto blocca lunghe assenze.
  v_credit := v_session.credited_seconds + least(greatest(v_delta, 0), v_elapsed + 0.1, 8.0);
  update vp_private.listening_sessions set credited_seconds = v_credit,
    last_position = p_position, last_ping_at = v_now where id = p_session;
  if p_finish then
    if p_position < v_duration - 0.25 or v_credit < v_duration - 0.5 then raise exception 'Ascolta il brano fino alla fine.'; end if;
    update vp_private.daily_selections set completed_at = coalesce(completed_at, v_now) where id = v_session.selection_id;
    update vp_private.listening_sessions set completed_at = v_now where id = p_session;
  end if;
  return jsonb_build_object('completed', coalesce(p_finish, false), 'creditedSeconds', v_credit);
end;
$$;

create function public.cast_vote(p_selection uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'Europe/Rome')::date;
begin
  perform 1 from public.profiles where id = v_uid for update;
  if v_now >= (v_day + time '21:00') at time zone 'Europe/Rome' then raise exception 'Il voto si è chiuso alle 21:00.'; end if;
  if not exists(select 1 from vp_private.daily_selections where id = p_selection and user_id = v_uid and day = v_day) then raise exception 'Brano non disponibile.'; end if;
  if (select count(*) from vp_private.daily_selections where user_id = v_uid and day = v_day and completed_at is not null) <> 5 then raise exception 'Completa tutti e cinque i brani.'; end if;
  insert into vp_private.votes(user_id, day, selection_id) values(v_uid, v_day, p_selection);
exception when unique_violation then raise exception 'Hai già votato oggi.';
end;
$$;

create function public.toggle_favorite(p_id uuid, p_is_track boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := vp_private.require_user(); v_track uuid;
begin
  perform 1 from public.profiles where id = v_uid for update;
  if p_is_track then
    select track_id into v_track from vp_private.favorites where user_id = v_uid and track_id = p_id;
    if v_track is null then raise exception 'Scoperta non disponibile.'; end if;
  else
    select s.track_id into v_track from vp_private.daily_selections s join vp_private.contests c on c.day = s.day
      where s.id = p_id and s.user_id = v_uid and clock_timestamp() >= c.closes_at;
    if v_track is null then raise exception 'Attendi il reveal prima di salvare.'; end if;
  end if;
  if exists(select 1 from vp_private.favorites where user_id = v_uid and track_id = v_track) then
    delete from vp_private.favorites where user_id = v_uid and track_id = v_track;
  else insert into vp_private.favorites(user_id, track_id) values(v_uid, v_track); end if;
end;
$$;

create function public.submit_application(p_artist text, p_title text, p_listeners integer,
  p_genre text, p_language text, p_subgenre text, p_mood text, p_spotify_id text, p_rights boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := vp_private.require_user(); v_id uuid;
begin
  insert into public.artist_applications(user_id, artist, title, listeners, genre, language, subgenre, mood, spotify_id, rights_confirmed)
    values(v_uid, trim(p_artist), trim(p_title), p_listeners, p_genre, p_language, trim(p_subgenre), p_mood, p_spotify_id, p_rights) returning id into v_id;
  return v_id;
end;
$$;

create function public.mark_reveal_seen(p_day date) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := vp_private.require_user();
begin
  if not exists(select 1 from vp_private.daily_selections s join vp_private.contests c on c.day = s.day
    where s.user_id = v_uid and s.day = p_day and clock_timestamp() >= c.closes_at) then raise exception 'Reveal non disponibile.'; end if;
  insert into vp_private.reveal_views(user_id, day) values(v_uid, p_day) on conflict do nothing;
end;
$$;

create function vp_private.ranking_rows(p_start date, p_end date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with exposures as (
    select s.track_id, count(*) as total from vp_private.daily_selections s where s.day between p_start and p_end group by s.track_id
  ), votes as (
    select s.track_id, count(*) as total from vp_private.votes v join vp_private.daily_selections s on s.id = v.selection_id where v.day between p_start and p_end group by s.track_id
  ), rows as (
    select t.id, t.title, a.name as artist, t.genre, e.total as exposures, coalesce(v.total, 0) as votes,
      coalesce(v.total, 0)::double precision / e.total as score
    from vp_private.tracks t join vp_private.artists a on a.id = t.artist_id join exposures e on e.track_id = t.id left join votes v on v.track_id = t.id
  ) select coalesce(jsonb_agg(to_jsonb(rows) order by score desc, exposures desc, id), '[]'::jsonb) from rows;
$$;
revoke all on function vp_private.ranking_rows(date, date) from public, anon, authenticated;

create function public.get_rankings(p_period text default 'day') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'Europe/Rome')::date;
  v_end date;
  v_start date;
begin
  if p_period not in ('day', 'week') or p_period is null then raise exception 'Periodo non valido.'; end if;
  v_end := case when v_now >= (v_day + time '21:00') at time zone 'Europe/Rome' then v_day else v_day - 1 end;
  if p_period = 'week' then v_end := v_end - extract(dow from v_end)::integer; end if;
  v_start := case when p_period = 'week' then v_end - 6 else v_end end;
  return jsonb_build_object('reference', v_end::text, 'rows', vp_private.ranking_rows(v_start, v_end));
end;
$$;

create function public.get_reveal(p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := vp_private.require_user(); v_result jsonb;
begin
  if not exists(select 1 from vp_private.contests c join vp_private.daily_selections s on s.day = c.day where s.user_id = v_uid and c.day = p_day and clock_timestamp() >= c.closes_at)
  then raise exception 'Reveal non disponibile.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', r->>'title', 'artist', r->>'artist',
    'genre', r->>'genre', 'exposures', r->'exposures', 'votes', r->'votes', 'score', r->'score')
    order by (r->>'score')::double precision desc, (r->>'exposures')::bigint desc, s.slot), '[]'::jsonb)
  into v_result from vp_private.daily_selections s
    join jsonb_array_elements(vp_private.ranking_rows(p_day, p_day)) r on (r->>'id')::uuid = s.track_id
    where s.user_id = v_uid and s.day = p_day;
  return v_result;
end;
$$;

-- PostgreSQL concede EXECUTE a PUBLIC per default: lo revochiamo esplicitamente.
revoke all on function public.save_profile(text, text, text[], boolean), public.get_dashboard(), public.begin_listening(uuid),
  public.listening_progress(uuid, double precision, boolean), public.cast_vote(uuid), public.toggle_favorite(uuid, boolean),
  public.submit_application(text, text, integer, text, text, text, text, text, boolean), public.mark_reveal_seen(date),
  public.get_rankings(text), public.get_reveal(date) from public, anon, authenticated;
grant execute on function public.save_profile(text, text, text[], boolean), public.get_dashboard(), public.begin_listening(uuid),
  public.listening_progress(uuid, double precision, boolean), public.cast_vote(uuid), public.toggle_favorite(uuid, boolean),
  public.submit_application(text, text, integer, text, text, text, text, text, boolean), public.mark_reveal_seen(date),
  public.get_rankings(text), public.get_reveal(date) to authenticated;

-- Il credito totale non puo superare la durata reale della sessione.
-- Questo blocca l'accumulo di tolleranze con molte richieste ravvicinate.
alter table vp_private.listening_sessions add column started_at timestamptz not null default clock_timestamp();

create or replace function public.listening_progress(p_session uuid, p_position double precision, p_finish boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_now timestamptz := clock_timestamp();
  v_session vp_private.listening_sessions%rowtype;
  v_duration double precision;
  v_delta double precision;
  v_elapsed double precision;
  v_credit double precision;
begin
  select * into v_session from vp_private.listening_sessions where id = p_session and user_id = v_uid for update;
  if not found or v_session.day <> (v_now at time zone 'Europe/Rome')::date or v_session.expires_at <= v_now
  then raise exception 'Sessione scaduta. Riavvia il brano.'; end if;
  if v_session.completed_at is not null then return jsonb_build_object('completed', true); end if;
  select t.duration_seconds into v_duration from vp_private.daily_selections s join vp_private.tracks t on t.id = s.track_id where s.id = v_session.selection_id;
  if p_position is null or not (p_position >= 0 and p_position <= v_duration + 0.25) then raise exception 'Posizione audio non valida.'; end if;
  v_delta := p_position - v_session.last_position;
  v_elapsed := greatest(0, extract(epoch from v_now - v_session.last_ping_at));
  if v_delta < -0.1 or v_delta > v_elapsed + 0.75 then raise exception 'Ascolto discontinuo. Riavvia il brano.'; end if;
  -- I heartbeat ogni ~3 s danno credito solo all'avanzamento e al tempo server,
  -- mai a una singola dichiarazione di completamento. Il tetto blocca lunghe assenze.
  v_credit := least(
    v_session.credited_seconds + least(greatest(v_delta, 0), v_elapsed + 0.1, 8.0),
    greatest(0, extract(epoch from v_now - v_session.started_at)) + 0.25
  );
  update vp_private.listening_sessions set credited_seconds = v_credit,
    last_position = p_position, last_ping_at = v_now where id = p_session;
  if p_finish then
    if p_position < v_duration - 0.25 or v_credit < v_duration - 0.5 then raise exception 'Ascolta il brano fino alla fine.'; end if;
    update vp_private.daily_selections set completed_at = coalesce(completed_at, v_now) where id = v_session.selection_id;
    update vp_private.listening_sessions set completed_at = v_now where id = p_session;
  end if;
  return jsonb_build_object('completed', coalesce(p_finish, false), 'creditedSeconds', v_credit);
end;
$$;


-- Token cifrati: accessibili soltanto alle funzioni server con service_role.
create table vp_private.spotify_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  credentials text not null,
  display_name text not null,
  spotify_id text not null,
  updated_at timestamptz not null default now()
);
create table vp_private.spotify_states (
  state_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null
);
alter table vp_private.spotify_connections enable row level security;
alter table vp_private.spotify_states enable row level security;
create function public.spotify_server(p_action text, p_user uuid, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_action = 'start' then
    delete from vp_private.spotify_states where expires_at < now() or user_id = p_user;
    insert into vp_private.spotify_states values(p_payload->>'hash',p_user,now()+interval '10 minutes');
  elsif p_action = 'consume' then
    delete from vp_private.spotify_states where state_hash=p_payload->>'hash' and user_id=p_user and expires_at>now() returning '{}'::jsonb into result;
    return result;
  elsif p_action = 'save' then
    insert into vp_private.spotify_connections(user_id,credentials,display_name,spotify_id)
    values(p_user,p_payload->>'credentials',p_payload->>'name',p_payload->>'id')
    on conflict(user_id) do update set credentials=excluded.credentials,display_name=excluded.display_name,spotify_id=excluded.spotify_id,updated_at=now();
  elsif p_action = 'get' then
    select jsonb_build_object('credentials',credentials,'name',display_name,'id',spotify_id) into result from vp_private.spotify_connections where user_id=p_user;
    return result;
  elsif p_action = 'delete' then
    delete from vp_private.spotify_connections where user_id=p_user;
    delete from vp_private.spotify_states where user_id=p_user;
  else raise exception 'Unknown action';
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.spotify_server(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.spotify_server(text,uuid,jsonb) to service_role;

-- Catalogo DEMO: artisti inventati, WAV sintetici di 12 secondi. Nessun voto/utente fittizio.
-- Ripetibile: non sovrascrive brani esistenti o metriche.
insert into vp_private.artists(id, name, demo_key, monthly_listeners, is_demo) values
('06f5b66a-35a1-719d-06f7-c1b015b35551', 'Luna Bassa', 't0', 820, true),
('77bdcf7f-4713-4cb4-e91f-ec61ad934d2c', 'Fuori Orario', 't1', 1091, true),
('35d0f1fb-caab-a80f-2108-c709773cc5fc', 'Nove', 't2', 1362, true),
('88a8b5c4-653d-d322-1fb5-827aeebbb43a', 'Iride', 't3', 1633, true),
('272603fe-ab55-96f2-84a4-f34a14eead65', 'Sottovoce', 't4', 1904, true),
('104c5bfa-8ed6-e951-bb34-c0880cfcd783', 'Marea', 't5', 2175, true),
('7d84d99e-c6b2-b8c0-dd00-ed38ac5a455e', 'Nina Sera', 't6', 2446, true),
('c7a5f079-1f94-9745-a126-103310fbe7be', 'Kairo', 't7', 2717, true),
('e71db62d-f626-f465-d960-1a37267e5468', 'Altrove', 't8', 2988, true),
('c641cf83-31e9-c154-db02-1eb590240724', 'Solea', 't9', 3259, true),
('383327f0-d38b-eb38-4724-abe6f5035b30', 'Milo', 't10', 3530, true),
('254913b9-fa6c-4afb-b551-8ec396900920', 'Cobalto', 't11', 3801, true),
('2881ed02-c2d9-f9ca-66dd-398d5f229ca6', 'Zero Nord', 't12', 4072, true),
('626efc44-a684-ba83-d502-d8c3df03b7ff', 'Etere', 't13', 4343, true),
('20a856ba-7b8c-b25a-e813-ed1e11cfcbb3', 'Amì', 't14', 4614, true),
('27b777a7-7648-560c-831d-d3c9ca6f806f', 'Vela', 't15', 4885, true),
('8f427625-09e7-039b-bce5-0c8369ff9d0f', 'Luce Fredda', 't16', 5156, true),
('d2e74a82-4aa6-bfdd-bfdf-f8a4415f46cc', 'Nadir', 't17', 5427, true),
('09631403-5d20-f8d9-ebd9-5809308895d5', 'Prisma', 't18', 5698, true),
('27c2149d-b1cb-98f9-e53b-b0c7aa5cf6fd', 'Dalia', 't19', 5969, true),
('ab27480f-b1bc-7337-9429-d884b36c54de', 'Nubi', 't20', 6240, true),
('c748e795-15e5-f726-a74b-d6f27d42068a', 'Elia Blu', 't21', 6511, true),
('a023d8bd-c8b6-66df-4c9c-c9b6eba2d15e', 'Rayo', 't22', 6782, true),
('fe68a8dd-c28d-0b54-83a8-121550ea8908', 'Mono', 't23', 7053, true),
('35eaf10f-69fd-b6c4-774a-a624b8eb81eb', 'Naima', 't24', 7324, true),
('9f7f7987-6de0-bb69-b11e-4eb5a9ef3c5c', 'Nexo', 't25', 650, true),
('96e4e1e9-2132-e116-13d8-e631a1edff06', 'Zeta Notte', 't26', 823, true),
('a476c82a-1d60-7db7-246b-295d1deeeb1b', 'Yuri K', 't27', 996, true),
('69108020-36f7-c054-fe76-c84e08e3eeb3', 'Mila V', 't28', 1169, true),
('77982581-4d49-87ee-c836-0c87204eff31', 'Dero', 't29', 1342, true),
('c8b9997c-89d1-ee27-9949-4c6ecc249341', 'Verso Uno', 't30', 1515, true),
('9d880a5e-fe55-d5fa-5356-f4dc48aee966', 'Rima Cruda', 't31', 1688, true),
('5677c76f-3065-12a3-4d02-04c8504a398d', 'Neri', 't32', 1861, true),
('807d0e3a-1310-98f5-2796-07d6631bc0fe', 'Ada Flow', 't33', 2034, true),
('f521c32f-94c2-199e-c39a-dcc9faeb338d', 'Blocco Est', 't34', 2207, true),
('46dcdea9-a5a7-db28-d2b9-d2dba5f3deb6', 'Kivo', 't35', 2380, true),
('c8ae56fc-433c-7d8b-9ae8-df91e7ce906b', 'Nord 7', 't36', 2553, true),
('d54185c7-16a4-aa15-ad7b-16afa4578a15', 'Drax', 't37', 2726, true),
('b84278cb-d52d-cb52-8634-748ee1351bc6', 'Vera K', 't38', 2899, true),
('f882524c-a85f-dede-9ecf-1f233cf15666', 'Teso', 't39', 3072, true),
('915ea19a-7428-7330-9b70-f991933f6b8c', 'Pietra Viva', 't40', 3245, true),
('5c75b8ae-fee7-793f-127b-b328d4f00d71', 'I Randagi', 't41', 3418, true),
('f4d6469d-e0ce-2138-30a2-94f159ca4fe4', 'Ruggine', 't42', 3591, true),
('04c2ed71-3943-8389-6df5-9cf66f5d9993', 'Eva Riot', 't43', 3764, true),
('32c26ce2-610a-db9f-9939-c3ebcfdc5452', 'Binario Nove', 't44', 3937, true),
('ce4e36ca-f703-1f03-2114-27e3f2921105', 'Lumi', 't45', 4110, true),
('2a51644e-e40e-8356-8785-92db440040e3', 'Nova Beat', 't46', 4283, true),
('f9d9fc6f-3d7d-4437-745a-2c5924ec4bac', 'Elios', 't47', 4456, true),
('c4ee156c-292e-314d-d41a-50c8a1579f73', 'Ivy Loop', 't48', 4629, true),
('8022201c-d29a-f2f2-f34d-13b17b4024c7', 'Duo Flash', 't49', 4802, true),
('b5561aa2-de93-c38c-e519-fa6ccc79137d', 'Casa Blu', 't50', 4975, true),
('de55f05f-2a27-9e04-0958-d44aed64b98d', 'Rio Groove', 't51', 5148, true),
('32248332-c1f2-33ea-3a41-feb879689680', 'Leda', 't52', 5321, true),
('0cc9166d-b125-24b3-2fa2-21fab8514a6d', 'Low Tide', 't53', 5494, true),
('5f0c131a-34f1-103f-f818-6b44764a2ec2', 'Miro Club', 't54', 5667, true),
('dbcee6f3-9286-e340-e0d9-531ac22b1b85', 'Modulo', 't55', 5840, true),
('37f43cb6-0c06-903b-02d6-d1012aabfce7', 'Kroma', 't56', 6013, true),
('1de92f64-f62e-2ecd-f60c-f73a3d67a9ac', 'Fase Due', 't57', 6186, true),
('3f934b3e-4204-b87f-cfee-c94a58e48bc2', 'Onda Zero', 't58', 6359, true),
('2843e3dd-3b49-2b33-71c9-27d698e831a4', 'Sintesi', 't59', 6532, true),
('d3b27cbd-33b4-f82a-66ff-23fa24fd1a5e', 'Lia Sol', 't60', 6705, true),
('9e903722-7452-d024-b929-9af204420da3', 'Tavo', 't61', 6878, true),
('191f6308-bc3a-68f0-f4ae-1bd9fe3bbbc4', 'Mar Azul', 't62', 7051, true),
('e3153f25-7b9d-bfd7-8b64-f5971eb7a677', 'Nela', 't63', 7224, true),
('c989d9f9-c3ac-46d1-0a7b-05af12ec2d20', 'Cruzito', 't64', 7397, true),
('bd8a5a70-8453-e8b9-d19a-7a7f8724e0e5', 'Ayo Bloom', 't65', 7570, true),
('c2642234-4004-8a37-f63a-2f2a1d9b77ec', 'Kemi Wave', 't66', 7743, true),
('e0e215f0-b7ac-4b46-ae67-88f64e998e8d', 'Tala', 't67', 7916, true),
('1f67d7d4-657b-ebae-b846-18c0f2f7fd44', 'Oba Sound', 't68', 8089, true),
('b3611595-160e-c298-ad8e-45d1b8430222', 'Sena', 't69', 8262, true),
('b335a813-cf46-b95d-305c-eeb5fc3ee973', 'Trio Aurora', 't70', 8435, true),
('ff56c09c-e065-c9b8-b1f2-8c0f04efa619', 'Marta Reed', 't71', 8608, true),
('9b9bc54e-9865-0743-e43c-c3de3ca24f35', 'Blu Quartetto', 't72', 8781, true),
('cfe300a0-d755-f98f-3083-b941f5d3241b', 'Leo Keys', 't73', 8954, true),
('50889699-9063-542a-0e54-312dbd1ea8a8', 'Alma Brass', 't74', 9127, true)
on conflict (demo_key) do nothing;
insert into vp_private.tracks(id, artist_id, title, genre, mood, language, audio_path, duration_seconds, demo_key, active, is_demo) values
('f6965516-f1de-90e3-3e6c-31ae25a97b80', '06f5b66a-35a1-719d-06f7-c1b015b35551', 'Vetro blu', 'Indie', 'Notturno', 'Inglese', '/audio/0.wav', 12, 't0', true, true),
('0c53e9bf-f703-ddc3-fa1a-98a33ea89ba0', '77bdcf7f-4713-4cb4-e91f-ec61ad934d2c', 'Non dormire', 'Pop', 'Energico', 'Italiano', '/audio/1.wav', 12, 't1', true, true),
('bf0e686e-5cdc-48fd-50df-01792fcb8343', '35d0f1fb-caab-a80f-2108-c709773cc5fc', 'Orbita', 'Hip hop', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't2', true, true),
('b8fa5b62-540c-c4e6-fef6-577f61429a29', '88a8b5c4-653d-d322-1fb5-827aeebbb43a', 'A luci spente', 'Elettronica', 'Euforico', 'Inglese', '/audio/3.wav', 12, 't3', true, true),
('5bdb928d-4626-24b0-a4e4-787dbea02182', '272603fe-ab55-96f2-84a4-f34a14eead65', 'Restiamo qui', 'R&B', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't4', true, true),
('b1c7f57e-3bcb-f141-6fd2-52c9d0893b13', '104c5bfa-8ed6-e951-bb34-c0880cfcd783', 'Altri giorni', 'Indie', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't5', true, true),
('ce0fc083-8b4e-11bf-9c31-1f7aa67880b3', '7d84d99e-c6b2-b8c0-dd00-ed38ac5a455e', 'Satelliti', 'Pop', 'Energico', 'Inglese', '/audio/1.wav', 12, 't6', true, true),
('39660b38-64f9-cff4-b578-a15d1f4046d0', 'c7a5f079-1f94-9745-a126-103310fbe7be', 'Cemento', 'Hip hop', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't7', true, true),
('cd135ae5-3deb-275b-ed20-784102a7ab4d', 'e71db62d-f626-f465-d960-1a37267e5468', 'Distanze', 'Elettronica', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't8', true, true),
('7736a30c-25d5-3aa2-f072-16fd01e40bd3', 'c641cf83-31e9-c154-db02-1eb590240724', 'Piano piano', 'R&B', 'Intimo', 'Inglese', '/audio/4.wav', 12, 't9', true, true),
('35987df9-ee79-e047-7b05-f2f6c4789a71', '383327f0-d38b-eb38-4724-abe6f5035b30', 'Domenica', 'Indie', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't10', true, true),
('418cce99-ec07-863a-e3de-36fa529a1684', '254913b9-fa6c-4afb-b551-8ec396900920', 'Senza rumore', 'Pop', 'Energico', 'Italiano', '/audio/1.wav', 12, 't11', true, true),
('e71f7434-e21c-cf40-2b6a-4adc2990984c', '2881ed02-c2d9-f9ca-66dd-398d5f229ca6', 'Sette piani', 'Hip hop', 'Sognante', 'Inglese', '/audio/2.wav', 12, 't12', true, true),
('6501f9d6-d9d6-8269-ed77-0dea69c25340', '626efc44-a684-ba83-d502-d8c3df03b7ff', 'Supernova', 'Elettronica', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't13', true, true),
('13cdadfd-1a37-8ddf-e1d7-ad9017b30538', '20a856ba-7b8c-b25a-e813-ed1e11cfcbb3', 'Fino a te', 'R&B', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't14', true, true),
('dc7a84d3-da40-6ef4-c476-ee054826ad74', '27b777a7-7648-560c-831d-d3c9ca6f806f', 'Fuori stagione', 'Indie', 'Notturno', 'Inglese', '/audio/0.wav', 12, 't15', true, true),
('59afd583-05e7-fa40-1745-664016758930', '8f427625-09e7-039b-bce5-0c8369ff9d0f', 'Città vuota', 'Pop', 'Energico', 'Italiano', '/audio/1.wav', 12, 't16', true, true),
('bb28cbfd-c5ef-d843-8f7d-47417e75f0a7', 'd2e74a82-4aa6-bfdd-bfdf-f8a4415f46cc', 'Verticale', 'Hip hop', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't17', true, true),
('a4181294-97a9-44d7-2ad1-cb511f8f8145', '09631403-5d20-f8d9-ebd9-5809308895d5', 'Onde corte', 'Elettronica', 'Euforico', 'Inglese', '/audio/3.wav', 12, 't18', true, true),
('dd396513-2135-18b5-4959-2def359767d9', '27c2149d-b1cb-98f9-e53b-b0c7aa5cf6fd', 'Le cose piccole', 'R&B', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't19', true, true),
('32f524bf-24c4-af3a-4cd0-92ddcc86bc6f', 'ab27480f-b1bc-7337-9429-d884b36c54de', 'Piove ancora', 'Indie', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't20', true, true),
('38d48c66-67f5-e1c9-866f-38bd9a7809cf', 'c748e795-15e5-f726-a74b-d6f27d42068a', 'Quasi estate', 'Pop', 'Energico', 'Inglese', '/audio/1.wav', 12, 't21', true, true),
('6c723211-1924-7f5d-1fbe-ab11a71eb3c9', 'a023d8bd-c8b6-66df-4c9c-c9b6eba2d15e', 'Polvere', 'Hip hop', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't22', true, true),
('29b6aed8-35d4-323c-96bb-89a1ecee124b', 'fe68a8dd-c28d-0b54-83a8-121550ea8908', 'Notte elettrica', 'Elettronica', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't23', true, true),
('aa547b5a-4efe-4735-05b5-93426473929b', '35eaf10f-69fd-b6c4-774a-a624b8eb81eb', 'Tra le righe', 'R&B', 'Intimo', 'Inglese', '/audio/4.wav', 12, 't24', true, true),
('4576cfed-25ca-4c69-e740-a2eab532068d', '9f7f7987-6de0-bb69-b11e-4eb5a9ef3c5c', 'Neon spenti', 'Trap', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't25', true, true),
('32aa6cfa-2936-fcff-579b-03d0f8ec425f', '96e4e1e9-2132-e116-13d8-e631a1edff06', 'Zona viola', 'Trap', 'Energico', 'Italiano', '/audio/1.wav', 12, 't26', true, true),
('d4a4305a-9cf7-8d72-5e0c-6cb8b4fb79ae', 'a476c82a-1d60-7db7-246b-295d1deeeb1b', 'Senza freni', 'Trap', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't27', true, true),
('f30c4fb9-da26-9474-b5ca-3fd74aa9a4f2', '69108020-36f7-c054-fe76-c84e08e3eeb3', 'Vetri scuri', 'Trap', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't28', true, true),
('bb886663-153e-a21a-ffcd-2b999548a81a', '77982581-4d49-87ee-c836-0c87204eff31', 'Ultima corsa', 'Trap', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't29', true, true),
('8192f613-271d-f189-6647-5e1cf6f71ce3', 'c8b9997c-89d1-ee27-9949-4c6ecc249341', 'Pagina bianca', 'Rap', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't30', true, true),
('ff617a29-0e42-0cc4-52f2-8e8ea636cecb', '9d880a5e-fe55-d5fa-5356-f4dc48aee966', 'Voce di quartiere', 'Rap', 'Energico', 'Italiano', '/audio/1.wav', 12, 't31', true, true),
('6d2af566-bdf7-29e0-0442-26e9e18917ba', '5677c76f-3065-12a3-4d02-04c8504a398d', 'Passi avanti', 'Rap', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't32', true, true),
('efc4b7da-7480-174c-fb69-f8a64cb48f47', '807d0e3a-1310-98f5-2796-07d6631bc0fe', 'A viso aperto', 'Rap', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't33', true, true),
('f5f70950-8be3-a145-8dcd-49c7077f9934', 'f521c32f-94c2-199e-c39a-dcc9faeb338d', 'Le mie strade', 'Rap', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't34', true, true),
('9001b771-b9dc-7fb9-b45c-e9f1b2a684f1', '46dcdea9-a5a7-db28-d2b9-d2dba5f3deb6', 'Asfalto freddo', 'Drill', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't35', true, true),
('e6b9ec45-0319-6af2-7bfc-db396928dc89', 'c8ae56fc-433c-7d8b-9ae8-df91e7ce906b', 'Linea nord', 'Drill', 'Energico', 'Italiano', '/audio/1.wav', 12, 't36', true, true),
('a90d7ee5-29fd-5af5-56b9-2ee1ab671af7', 'd54185c7-16a4-aa15-ad7b-16afa4578a15', 'Fuori campo', 'Drill', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't37', true, true),
('5e80a852-a3fa-4f62-a62f-35d042ce413a', 'b84278cb-d52d-cb52-8634-748ee1351bc6', 'Passo veloce', 'Drill', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't38', true, true),
('58b56054-75b6-863e-20b4-17811dc013d3', 'f882524c-a85f-dede-9ecf-1f233cf15666', 'Luci basse', 'Drill', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't39', true, true),
('3d249621-98b9-b214-451d-a656b44233d9', '915ea19a-7428-7330-9b70-f991933f6b8c', 'Scintille', 'Rock', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't40', true, true),
('de31dc90-55a4-0ad4-ca09-d4b515c39640', '5c75b8ae-fee7-793f-127b-b328d4f00d71', 'Oltre il muro', 'Rock', 'Energico', 'Italiano', '/audio/1.wav', 12, 't41', true, true),
('04d1442d-03ed-7e7e-b3fc-3472acc423c0', 'f4d6469d-e0ce-2138-30a2-94f159ca4fe4', 'Strade rotte', 'Rock', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't42', true, true),
('b2d7fe0b-7e65-1a03-afca-a0ad5b644617', '04c2ed71-3943-8389-6df5-9cf66f5d9993', 'Volume alto', 'Rock', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't43', true, true),
('d5da1fac-de8f-8e4d-8eb6-481dbf69ad8b', '32c26ce2-610a-db9f-9939-c3ebcfdc5452', 'Fino al mattino', 'Rock', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't44', true, true),
('b56ac8a4-88a1-e68e-a405-34a8bfb4eedb', 'ce4e36ca-f703-1f03-2114-27e3f2921105', 'Tutta la notte', 'Dance', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't45', true, true),
('584de295-4d9b-0be6-2e9c-b4a319cb2f9c', '2a51644e-e40e-8356-8785-92db440040e3', 'Luci in pista', 'Dance', 'Energico', 'Italiano', '/audio/1.wav', 12, 't46', true, true),
('ce32069f-582c-4d82-574d-712e0b177930', 'f9d9fc6f-3d7d-4437-745a-2c5924ec4bac', 'Un altro giro', 'Dance', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't47', true, true),
('667b2c60-8782-bd68-f24e-2d6168fec126', 'c4ee156c-292e-314d-d41a-50c8a1579f73', 'Muoviti con me', 'Dance', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't48', true, true),
('51512876-0d0f-730d-d0fd-9f2e08ec791c', '8022201c-d29a-f2f2-f34d-13b17b4024c7', 'Alba rosa', 'Dance', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't49', true, true),
('f1ddf431-a096-af17-e8e4-e5c954755e2a', 'b5561aa2-de93-c38c-e519-fa6ccc79137d', 'Dopo mezzanotte', 'House', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't50', true, true),
('63b1a9b6-728f-c27a-4fc5-ffdea6e57830', 'de55f05f-2a27-9e04-0958-d44aed64b98d', 'Aria calda', 'House', 'Energico', 'Italiano', '/audio/1.wav', 12, 't51', true, true),
('74d2569a-cea5-53a0-c7c2-05410b0f9a41', '32248332-c1f2-33ea-3a41-feb879689680', 'In movimento', 'House', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't52', true, true),
('2c75165a-1344-a09f-d1e1-3a31b8771965', '0cc9166d-b125-24b3-2fa2-21fab8514a6d', 'Riflessi sul mare', 'House', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't53', true, true),
('721f9fee-67df-8b63-c36f-19fedc0174fc', '5f0c131a-34f1-103f-f818-6b44764a2ec2', 'Stessa frequenza', 'House', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't54', true, true),
('f6ee88ca-2398-480b-c6d8-681b63ec7873', 'dbcee6f3-9286-e340-e0d9-531ac22b1b85', 'Impulso', 'Techno', 'Notturno', 'Italiano', '/audio/0.wav', 12, 't55', true, true),
('731baf1a-1ec8-30f1-1336-f2a15c0e7cbd', '37f43cb6-0c06-903b-02d6-d1012aabfce7', 'Circuiti', 'Techno', 'Energico', 'Italiano', '/audio/1.wav', 12, 't56', true, true),
('5c7105f9-7441-ccbb-1231-ca440f4f4d9c', '1de92f64-f62e-2ecd-f60c-f73a3d67a9ac', 'Spazio minimo', 'Techno', 'Sognante', 'Italiano', '/audio/2.wav', 12, 't57', true, true),
('b6062948-41ff-b25b-1910-342a4c61e525', '3f934b3e-4204-b87f-cfee-c94a58e48bc2', 'Pressione', 'Techno', 'Euforico', 'Italiano', '/audio/3.wav', 12, 't58', true, true),
('4df4662d-3cca-d640-2fbd-167115b1016f', '2843e3dd-3b49-2b33-71c9-27d698e831a4', 'Sequenza aperta', 'Techno', 'Intimo', 'Italiano', '/audio/4.wav', 12, 't59', true, true),
('b057f0f6-7f0b-e4ad-5cfd-575bdd5bc84a', 'd3b27cbd-33b4-f82a-66ff-23fa24fd1a5e', 'Bajo la luna', 'Reggaeton', 'Notturno', 'Spagnolo', '/audio/0.wav', 12, 't60', true, true),
('595a36f1-b07a-8376-116f-65b03e489c54', '9e903722-7452-d024-b929-9af204420da3', 'Sin prisa', 'Reggaeton', 'Energico', 'Spagnolo', '/audio/1.wav', 12, 't61', true, true),
('ecb2719f-9125-ef4f-8ade-7ee10cad5db8', '191f6308-bc3a-68f0-f4ae-1bd9fe3bbbc4', 'Arena dorada', 'Reggaeton', 'Sognante', 'Spagnolo', '/audio/2.wav', 12, 't62', true, true),
('2a6c1ec3-9401-8dbd-f273-1e206c69d080', 'e3153f25-7b9d-bfd7-8b64-f5971eb7a677', 'Otra vez', 'Reggaeton', 'Euforico', 'Spagnolo', '/audio/3.wav', 12, 't63', true, true),
('f22328c9-289e-2001-8a66-05cf7febb221', 'c989d9f9-c3ac-46d1-0a7b-05af12ec2d20', 'Hasta el sol', 'Reggaeton', 'Intimo', 'Spagnolo', '/audio/4.wav', 12, 't64', true, true),
('9b9a59cc-522f-ffdd-f6f1-ee0db501fbf4', 'bd8a5a70-8453-e8b9-d19a-7a7f8724e0e5', 'Golden Steps', 'Afrobeat', 'Notturno', 'Inglese', '/audio/0.wav', 12, 't65', true, true),
('75565eea-f861-9d73-5352-6c4a0ab5f5ed', 'c2642234-4004-8a37-f63a-2f2a1d9b77ec', 'Warm Breeze', 'Afrobeat', 'Energico', 'Inglese', '/audio/1.wav', 12, 't66', true, true),
('b965c447-1076-8678-74f8-63c2cf37dde6', 'e0e215f0-b7ac-4b46-ae67-88f64e998e8d', 'Open Sky', 'Afrobeat', 'Sognante', 'Inglese', '/audio/2.wav', 12, 't67', true, true),
('5e608b6c-b0b5-1691-639d-97c0c75d9700', '1f67d7d4-657b-ebae-b846-18c0f2f7fd44', 'Morning Light', 'Afrobeat', 'Euforico', 'Inglese', '/audio/3.wav', 12, 't68', true, true),
('0cdde188-08f1-48a0-e210-9eca06049c2f', 'b3611595-160e-c298-ad8e-45d1b8430222', 'Move Together', 'Afrobeat', 'Intimo', 'Inglese', '/audio/4.wav', 12, 't69', true, true),
('2ab19375-9668-743a-5a74-9af676495b0c', 'b335a813-cf46-b95d-305c-eeb5fc3ee973', 'Fumo lento', 'Jazz', 'Notturno', 'Strumentale', '/audio/0.wav', 12, 't70', true, true),
('dc70c38d-a7fd-0501-6636-e583c29a2ebf', 'ff56c09c-e065-c9b8-b1f2-8c0f04efa619', 'Una sera ancora', 'Jazz', 'Energico', 'Strumentale', '/audio/1.wav', 12, 't71', true, true),
('7a97ca02-506f-01b7-90b5-454c498cd660', '9b9bc54e-9865-0743-e43c-c3de3ca24f35', 'Piccole pause', 'Jazz', 'Sognante', 'Strumentale', '/audio/2.wav', 12, 't72', true, true),
('4e6743bb-7c29-1ba8-8fcf-7cd06b241b31', 'cfe300a0-d755-f98f-3083-b941f5d3241b', 'Tra due accordi', 'Jazz', 'Euforico', 'Strumentale', '/audio/3.wav', 12, 't73', true, true),
('4f0bcbde-9795-3efe-0b5a-49657ff537c6', '50889699-9063-542a-0e54-312dbd1ea8a8', 'Ultimo tavolo', 'Jazz', 'Intimo', 'Strumentale', '/audio/4.wav', 12, 't74', true, true)
on conflict (demo_key) do nothing;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations(version, name) values ('20261005000100', 'initial_schema');
insert into supabase_migrations.schema_migrations(version, name) values ('20261005000200', 'reference_data');
insert into supabase_migrations.schema_migrations(version, name) values ('20261005000300', 'contest_api');
insert into supabase_migrations.schema_migrations(version, name) values ('20261005000400', 'bound_session_credit');
insert into supabase_migrations.schema_migrations(version, name) values ('20261006000100', 'spotify');
commit;
