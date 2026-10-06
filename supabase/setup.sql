-- Eseguire UNA VOLTA nel SQL Editor del progetto Supabase vuoto.
-- Migrazioni atomiche e storico CLI: niente reset/drop, niente chiavi segrete.
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

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations(version, name) values ('20261005000100', 'initial_schema');
insert into supabase_migrations.schema_migrations(version, name) values ('20261005000200', 'reference_data');
insert into supabase_migrations.schema_migrations(version, name) values ('20261005000300', 'contest_api');
insert into supabase_migrations.schema_migrations(version, name) values ('20261005000400', 'bound_session_credit');
insert into supabase_migrations.schema_migrations(version, name) values ('20261006000100', 'spotify');
commit;
