-- UNA VOLTA sul progetto esistente, dopo artist-profiles.sql.
begin;
-- Nessuna cancellazione: campioni e storico demo restano esclusi dalle funzioni pubbliche.
update vp_private.tracks set active=false where is_demo or artist_id in(select id from vp_private.artists where is_demo);

create function vp_private.is_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u where u.id=p_user and u.email_confirmed_at is not null
    and (lower(u.email)='santonithomas9@gmail.com' or exists(select 1 from vp_private.admin_accounts a where a.user_id=u.id)));
$$;
revoke all on function vp_private.is_admin(uuid) from public,anon,authenticated;

create or replace function vp_private.check_artist_quota(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_type text;
begin
  select account_type into v_type from public.profiles where id=p_user for update;
  if v_type is distinct from 'artist' then raise exception 'Attiva il profilo Artista per candidare un brano.'; end if;
  if vp_private.is_admin(p_user) then return; end if;
  if exists(select 1 from public.artist_applications where user_id=p_user
    and submitted_at >= (date_trunc('month',clock_timestamp() at time zone 'Europe/Rome') at time zone 'Europe/Rome')) then
    raise exception 'Hai già inviato una traccia questo mese. Potrai candidarne un’altra dal primo giorno del prossimo mese.';
  end if;
end;
$$;

drop function public.get_rankings(text);
create function public.get_rankings(p_period text default 'day',p_day date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_now timestamptz := clock_timestamp();
  v_today date := (v_now at time zone 'Europe/Rome')::date;
  v_latest date;
  v_end date;
  v_start date;
begin
  if p_period not in ('day','week') or p_period is null then raise exception 'Periodo non valido.'; end if;
  v_latest:=case when v_now >= (v_today+time '21:00') at time zone 'Europe/Rome' then v_today else v_today-1 end;
  if p_day>v_latest then raise exception 'La classifica sarà disponibile dopo la chiusura del contest alle 21:00.'; end if;
  v_end:=coalesce(p_day,v_latest);
  if p_period='week' then v_end:=v_end-extract(dow from v_end)::integer; end if;
  v_start:=case when p_period='week' then v_end-6 else v_end end;
  return jsonb_build_object('reference',v_end::text,'latestDay',v_latest::text,'rows',vp_private.ranking_rows(v_start,v_end));
end;
$$;
revoke all on function public.get_rankings(text,date) from public,anon;
grant execute on function public.get_rankings(text,date) to authenticated;

-- Le funzioni seguenti filtrano anche selezioni e preferiti demo già esistenti.

create or replace function vp_private.ensure_daily_selection(p_uid uuid) returns void
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
    where not t.is_demo and not a.is_demo and t.active and t.audio_deleted_at is null and (t.contest_day is null or t.contest_day=v_day) and (a.is_demo or a.eligibility_verified_at is not null) and a.monthly_listeners < 10000;
  if v_count < 5 then return; end if;
  insert into vp_private.contests(day, closes_at)
    values(v_day, (v_day + time '21:00') at time zone 'Europe/Rome') on conflict do nothing;
  with candidates as (
    select t.id, -ln(greatest(random(), 0.000000001)) * (1 + (select count(*) from vp_private.daily_selections s where s.track_id = t.id)) as weight
    from vp_private.tracks t join vp_private.artists a on a.id = t.artist_id
    join public.user_preferences p on p.genre = t.genre and p.user_id = p_uid
    where not t.is_demo and not a.is_demo and t.active and t.audio_deleted_at is null and (t.contest_day is null or t.contest_day=v_day) and (a.is_demo or a.eligibility_verified_at is not null) and a.monthly_listeners < 10000
  ), chosen as (select id, weight from candidates order by weight limit 5)
  insert into vp_private.daily_selections(user_id, day, slot, track_id)
    select p_uid, v_day, row_number() over(order by weight)::smallint, id from chosen;
end;
$$;
create or replace function vp_private.ranking_rows(p_start date, p_end date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with exposures as (
    select s.track_id, count(*) as total from vp_private.daily_selections s where s.day between p_start and p_end group by s.track_id
  ), votes as (
    select s.track_id, count(*) as total from vp_private.votes v join vp_private.daily_selections s on s.id = v.selection_id where v.day between p_start and p_end group by s.track_id
  ), rows as (
    select t.id, t.title, a.name as artist, t.genre, t.is_demo as "isDemo", coalesce(t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id) as "spotifyUrl", e.total as exposures, coalesce(v.total, 0) as votes,
      coalesce(v.total, 0)::double precision / e.total as score
    from vp_private.tracks t join vp_private.artists a on a.id = t.artist_id join exposures e on e.track_id = t.id left join votes v on v.track_id = t.id where not t.is_demo and not a.is_demo
  ) select coalesce(jsonb_agg(to_jsonb(rows) order by score desc, exposures desc, id), '[]'::jsonb) from rows;
$$;
create or replace function public.begin_listening(p_selection uuid) returns jsonb
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
  select * into v_selection from vp_private.daily_selections where id = p_selection and user_id = v_uid and day = v_day and track_id in(select t.id from vp_private.tracks t join vp_private.artists a on a.id=t.artist_id where not t.is_demo and not a.is_demo);
  if not found then raise exception 'Brano non disponibile per oggi.'; end if;
  if exists(select 1 from vp_private.daily_selections where user_id = v_uid and day = v_day and slot < v_selection.slot and completed_at is null)
  then raise exception 'Completa il brano precedente.'; end if;
  select audio_path, duration_seconds into v_audio, v_duration from vp_private.tracks where id = v_selection.track_id;
  if clock_timestamp() >= (v_day + time '21:00') at time zone 'Europe/Rome' then raise exception 'Il contest è terminato. Scopri il brano su Spotify.'; end if;
  if v_audio is null then raise exception 'Audio non più disponibile. Il link Spotify resta nel reveal.'; end if;
  delete from vp_private.listening_sessions where user_id = v_uid;
  insert into vp_private.listening_sessions(user_id, day, selection_id) values(v_uid, v_day, p_selection) returning id into v_session;
  return jsonb_build_object('sessionId', v_session, 'audioUrl', v_audio, 'duration', v_duration);
end;
$$;
create or replace function public.get_dashboard() returns jsonb
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
  select jsonb_build_object('uid', p.id, 'accountType', p.account_type, 'name', p.display_name, 'theme', p.theme,
    'onboard', p.onboarded, 'connected', false,
    'prefs', coalesce((select jsonb_agg(up.genre order by g.display_order) from public.user_preferences up join public.genres g on g.name = up.genre where up.user_id = v_uid), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'artist', a.artist, 'title', a.title, 'listeners', a.listeners, 'genre', a.genre, 'language', a.language, 'subgenre', a.subgenre, 'mood', a.mood, 'status', a.status, 'spotify', 'https://open.spotify.com/track/' || a.spotify_id, 'created', a.created_at, 'submittedAt', a.submitted_at, 'audioDeletedAt', a.audio_deleted_at, 'audioState', (select aa.state from vp_private.audio_assets aa where aa.application_id=a.id), 'contestDay', (select t.contest_day from vp_private.audio_assets aa join vp_private.tracks t on t.id=aa.track_id where aa.application_id=a.id)) order by a.created_at desc) from public.artist_applications a where a.user_id = v_uid), '[]'::jsonb),
    'seenReveals', coalesce((select jsonb_agg(rv.day::text) from vp_private.reveal_views rv where rv.user_id = v_uid), '[]'::jsonb)
  ) into v_profile from public.profiles p where p.id = v_uid;
  if v_profile is null then raise exception 'Profilo non disponibile.'; end if;
  select coalesce(jsonb_object_agg(day::text, payload), '{}'::jsonb) into v_rounds from (
    select s.day, jsonb_build_object('day', s.day::text,
      'ids', jsonb_agg(s.id order by s.slot),
      'listened', coalesce(jsonb_agg(s.id order by s.slot) filter(where s.completed_at is not null), '[]'::jsonb),
      'vote', (select v.selection_id from vp_private.votes v where v.user_id = v_uid and v.day = s.day),
      'completionVersion', 2) payload
    from vp_private.daily_selections s where s.user_id = v_uid and s.track_id in(select t.id from vp_private.tracks t join vp_private.artists a on a.id=t.artist_id where not t.is_demo and not a.is_demo) group by s.day
  ) rounds;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'genre', t.genre, 'mood', t.mood,
    'lang', t.language, 'duration', t.duration_seconds, 'isDemo', t.is_demo,
    'title', case when v_now >= c.closes_at then t.title else null end,
    'artist', case when v_now >= c.closes_at then a.name else null end,
    'spotifyUrl', case when v_now >= c.closes_at then coalesce(t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id) else null end,
    'saved', exists(select 1 from vp_private.favorites f where f.user_id = v_uid and f.track_id = t.id)
  ) order by s.day, s.slot), '[]'::jsonb) into v_tracks
  from vp_private.daily_selections s join vp_private.contests c on c.day = s.day
  join vp_private.tracks t on t.id = s.track_id join vp_private.artists a on a.id = t.artist_id
  where s.user_id = v_uid and not t.is_demo and not a.is_demo;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'artist', a.name, 'genre', t.genre, 'isDemo', t.is_demo, 'spotifyUrl', coalesce(t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id)) order by f.created_at desc), '[]'::jsonb) into v_favorites
  from vp_private.favorites f join vp_private.tracks t on t.id = f.track_id join vp_private.artists a on a.id = t.artist_id where f.user_id = v_uid and not t.is_demo and not a.is_demo;
  return jsonb_build_object('profile', v_profile || jsonb_build_object('rounds', v_rounds, 'saved', (select coalesce(jsonb_agg(item->'id'), '[]'::jsonb) from jsonb_array_elements(v_favorites) item)),
    'tracks', v_tracks, 'favorites', v_favorites,
    'clock', jsonb_build_object('day', v_day::text, 'seconds', extract(hour from v_now at time zone 'Europe/Rome') * 3600 + extract(minute from v_now at time zone 'Europe/Rome') * 60 + extract(second from v_now at time zone 'Europe/Rome'),
      'revealed', v_now >= (v_day + time '21:00') at time zone 'Europe/Rome'), 'serverTime', v_now);
end;
$$;

insert into supabase_migrations.schema_migrations(version,name) values ('20261006000600','real_contests') on conflict(version) do nothing;
commit;
