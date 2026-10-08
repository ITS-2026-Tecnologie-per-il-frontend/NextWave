-- UNA VOLTA sul progetto esistente, dopo multiple-superadmins.sql.
begin;
-- Salvataggio dopo l’ascolto, con identità protetta fino al reveal.
create or replace function public.toggle_favorite(p_id uuid, p_is_track boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := vp_private.require_user(); v_track uuid;
begin
  perform 1 from public.profiles where id = v_uid for update;
  if p_is_track then
    select track_id into v_track from vp_private.favorites where user_id = v_uid and track_id = p_id;
    if v_track is null then raise exception 'Scoperta non disponibile.'; end if;
  else
    select s.track_id into v_track from vp_private.daily_selections s join vp_private.contests c on c.day = s.day
      where s.id = p_id and s.user_id = v_uid and (s.completed_at is not null or clock_timestamp() >= c.closes_at);
    if v_track is null then raise exception 'Completa l’ascolto prima di salvare.'; end if;
  end if;
  if exists(select 1 from vp_private.favorites where user_id = v_uid and track_id = v_track) then
    delete from vp_private.favorites where user_id = v_uid and track_id = v_track;
  else insert into vp_private.favorites(user_id, track_id) values(v_uid, v_track); end if;
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
  select jsonb_build_object('uid', p.id, 'accountType', p.account_type, 'name', p.display_name,
    'avatarPath', p.avatar_path, 'theme', p.theme, 'onboard', p.onboarded, 'connected', false,
    'prefs', coalesce((select jsonb_agg(up.genre order by g.display_order) from public.user_preferences up join public.genres g on g.name = up.genre where up.user_id = v_uid), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'artist', a.artist, 'title', a.title, 'listeners', a.listeners, 'genre', a.genre, 'language', a.language, 'subgenre', a.subgenre, 'mood', a.mood, 'status', a.status, 'spotify', coalesce(a.source_url, 'https://open.spotify.com/track/' || a.spotify_id), 'created', a.created_at, 'submittedAt', a.submitted_at, 'audioDeletedAt', a.audio_deleted_at, 'audioState', (select aa.state from vp_private.audio_assets aa where aa.application_id=a.id), 'contestDay', (select t.contest_day from vp_private.audio_assets aa join vp_private.tracks t on t.id=aa.track_id where aa.application_id=a.id)) order by a.created_at desc) from public.artist_applications a where a.user_id = v_uid), '[]'::jsonb),
    'seenReveals', coalesce((select jsonb_agg(rv.day::text) from vp_private.reveal_views rv where rv.user_id = v_uid), '[]'::jsonb)
  ) into v_profile from public.profiles p where p.id = v_uid;
  if v_profile is null then raise exception 'Profilo non disponibile.'; end if;
  select coalesce(jsonb_object_agg(day::text, payload), '{}'::jsonb) into v_rounds from (
    select s.day, jsonb_build_object('day', s.day::text, 'ids', jsonb_agg(s.id order by s.slot),
      'listened', coalesce(jsonb_agg(s.id order by s.slot) filter(where s.completed_at is not null), '[]'::jsonb),
      'vote', (select v.selection_id from vp_private.votes v where v.user_id = v_uid and v.day = s.day), 'completionVersion', 2) payload
    from vp_private.daily_selections s where s.user_id = v_uid and s.track_id in(select t.id from vp_private.tracks t join vp_private.artists a on a.id=t.artist_id where not t.is_demo and not a.is_demo) group by s.day
  ) rounds;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'genre', t.genre, 'mood', t.mood, 'lang', t.language, 'duration', t.duration_seconds, 'isDemo', t.is_demo,
    'title', case when v_now >= c.closes_at then t.title else null end, 'artist', case when v_now >= c.closes_at then a.name else null end,
    'spotifyUrl', case when v_now >= c.closes_at then coalesce(t.source_url, t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id) else null end,
    'saved', exists(select 1 from vp_private.favorites f where f.user_id = v_uid and f.track_id = t.id)) order by s.day, s.slot), '[]'::jsonb) into v_tracks
  from vp_private.daily_selections s join vp_private.contests c on c.day = s.day join vp_private.tracks t on t.id = s.track_id join vp_private.artists a on a.id = t.artist_id
  where s.user_id = v_uid and not t.is_demo and not a.is_demo;
  -- Salvare non anticipa il reveal: identità e link sono visibili solo dopo la chiusura.
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id,
    'title', case when visibility.revealed then t.title else null end,
    'artist', case when visibility.revealed then a.name else null end,
    'genre', t.genre, 'isDemo', t.is_demo,
    'spotifyUrl', case when visibility.revealed then coalesce(t.source_url, t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id) else null end)
    order by f.created_at desc), '[]'::jsonb) into v_favorites
  from vp_private.favorites f join vp_private.tracks t on t.id=f.track_id join vp_private.artists a on a.id=t.artist_id
  cross join lateral (select exists(
    select 1 from vp_private.daily_selections s join vp_private.contests c on c.day=s.day
    where s.user_id=v_uid and s.track_id=t.id and v_now>=c.closes_at
  ) as revealed) visibility
  where f.user_id=v_uid and not t.is_demo and not a.is_demo;
  return jsonb_build_object('profile', v_profile || jsonb_build_object('rounds', v_rounds, 'saved', (select coalesce(jsonb_agg(item->'id'), '[]'::jsonb) from jsonb_array_elements(v_favorites) item)),
    'tracks', v_tracks, 'favorites', v_favorites, 'clock', jsonb_build_object('day', v_day::text, 'seconds', extract(hour from v_now at time zone 'Europe/Rome') * 3600 + extract(minute from v_now at time zone 'Europe/Rome') * 60 + extract(second from v_now at time zone 'Europe/Rome'), 'revealed', v_now >= (v_day + time '21:00') at time zone 'Europe/Rome'), 'serverTime', v_now);
end;
$$;

insert into supabase_migrations.schema_migrations(version,name) values ('20261008000500','contest_favorites') on conflict(version) do nothing;
commit;
