alter table public.profiles add column avatar_path text;

do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
    values ('nextwave-avatars','nextwave-avatars',false,5000000,
      ARRAY['image/jpeg','image/png','image/webp','image/gif'])
    on conflict(id) do update set
      public=false,
      file_size_limit=5000000,
      allowed_mime_types=excluded.allowed_mime_types;
  end if;
end $$;

do $$ begin
  if to_regclass('storage.objects') is not null then
    create policy avatar_insert_own on storage.objects
      for insert to authenticated
      with check (bucket_id='nextwave-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));
    create policy avatar_update_own on storage.objects
      for update to authenticated
      using (bucket_id='nextwave-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text))
      with check (bucket_id='nextwave-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));
    create policy avatar_select_own on storage.objects
      for select to authenticated
      using (bucket_id='nextwave-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));
    create policy avatar_delete_own on storage.objects
      for delete to authenticated
      using (bucket_id='nextwave-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));
  end if;
end $$;

create function public.set_avatar_path(p_path text) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := vp_private.require_user();
begin
  if p_path is not null and p_path !~ ('^' || v_uid::text || '/profile\.(jpg|png|webp|gif)$') then
    raise exception 'Percorso immagine non valido.';
  end if;
  update public.profiles set avatar_path=p_path,updated_at=clock_timestamp() where id=v_uid;
  if not found then raise exception 'Profilo non disponibile.'; end if;
end;
$$;
revoke all on function public.set_avatar_path(text) from public,anon;
grant execute on function public.set_avatar_path(text) to authenticated;

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
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'artist', a.artist, 'title', a.title, 'listeners', a.listeners, 'genre', a.genre, 'language', a.language, 'subgenre', a.subgenre, 'mood', a.mood, 'status', a.status, 'spotify', 'https://open.spotify.com/track/' || a.spotify_id, 'created', a.created_at, 'submittedAt', a.submitted_at, 'audioDeletedAt', a.audio_deleted_at, 'audioState', (select aa.state from vp_private.audio_assets aa where aa.application_id=a.id), 'contestDay', (select t.contest_day from vp_private.audio_assets aa join vp_private.tracks t on t.id=aa.track_id where aa.application_id=a.id)) order by a.created_at desc) from public.artist_applications a where a.user_id = v_uid), '[]'::jsonb),
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
    'spotifyUrl', case when v_now >= c.closes_at then coalesce(t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id) else null end,
    'saved', exists(select 1 from vp_private.favorites f where f.user_id = v_uid and f.track_id = t.id)) order by s.day, s.slot), '[]'::jsonb) into v_tracks
  from vp_private.daily_selections s join vp_private.contests c on c.day = s.day join vp_private.tracks t on t.id = s.track_id join vp_private.artists a on a.id = t.artist_id
  where s.user_id = v_uid and not t.is_demo and not a.is_demo;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'artist', a.name, 'genre', t.genre, 'isDemo', t.is_demo, 'spotifyUrl', coalesce(t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id)) order by f.created_at desc), '[]'::jsonb) into v_favorites
  from vp_private.favorites f join vp_private.tracks t on t.id = f.track_id join vp_private.artists a on a.id = t.artist_id where f.user_id = v_uid and not t.is_demo and not a.is_demo;
  return jsonb_build_object('profile', v_profile || jsonb_build_object('rounds', v_rounds, 'saved', (select coalesce(jsonb_agg(item->'id'), '[]'::jsonb) from jsonb_array_elements(v_favorites) item)),
    'tracks', v_tracks, 'favorites', v_favorites, 'clock', jsonb_build_object('day', v_day::text, 'seconds', extract(hour from v_now at time zone 'Europe/Rome') * 3600 + extract(minute from v_now at time zone 'Europe/Rome') * 60 + extract(second from v_now at time zone 'Europe/Rome'), 'revealed', v_now >= (v_day + time '21:00') at time zone 'Europe/Rome'), 'serverTime', v_now);
end;
$$;
