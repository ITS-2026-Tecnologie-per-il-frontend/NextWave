-- UNA VOLTA, dopo live-genre-preferences.sql.
begin;
-- Preferiti nel contesto di ascolto e ritiro delle candidature, conservando le quote.
alter table public.artist_applications add column if not exists removed_at timestamptz;
alter table vp_private.favorites add column if not exists selection_id uuid references vp_private.daily_selections(id) on delete set null;
update vp_private.favorites f set selection_id=(select s.id from vp_private.daily_selections s where s.user_id=f.user_id and s.track_id=f.track_id order by s.day desc,s.slot limit 1);

create or replace function public.toggle_favorite(p_id uuid,p_is_track boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=vp_private.require_user(); v_track uuid;
begin
  perform 1 from public.profiles where id=v_uid for update;
  if p_is_track then
    delete from vp_private.favorites where user_id=v_uid and track_id=p_id;
    if not found then raise exception 'Scoperta non disponibile.'; end if;
    return;
  end if;
  select s.track_id into v_track from vp_private.daily_selections s join vp_private.contests c on c.day=s.day
  where s.id=p_id and s.user_id=v_uid and (clock_timestamp()>=c.closes_at or s.completed_at is not null);
  if v_track is null then raise exception 'Completa l’ascolto prima di salvare.'; end if;
  if exists(select 1 from vp_private.favorites where user_id=v_uid and track_id=v_track) then
    delete from vp_private.favorites where user_id=v_uid and track_id=v_track;
  else insert into vp_private.favorites(user_id,track_id,selection_id) values(v_uid,v_track,p_id); end if;
end; $$;

create or replace function public.remove_application(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=vp_private.require_user(); v_app public.artist_applications%rowtype;
begin
  -- Stesso ordine di lock della revisione: audio, poi candidatura.
  perform 1 from vp_private.audio_assets where application_id=p_id and user_id=v_uid for update;
  select * into v_app from public.artist_applications where id=p_id and user_id=v_uid for update;
  if not found then raise exception 'Candidatura non disponibile.'; end if;
  if v_app.status='approved' then raise exception 'Le candidature approvate non possono essere eliminate.'; end if;
  if v_app.removed_at is not null then return; end if;
  update public.artist_applications set status='rejected',removed_at=clock_timestamp() where id=p_id;
  update vp_private.audio_assets set expires_at=clock_timestamp(),upload_expires_at=clock_timestamp() where application_id=p_id;
end; $$;
revoke all on function public.remove_application(uuid) from public,anon;
grant execute on function public.remove_application(uuid) to authenticated;

create or replace function public.admin_console(p_action text, p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_access jsonb := public.get_admin_access();
  v_target uuid;
  v_application uuid;
  v_result jsonb;
  v_path text;
  v_note text := trim(coalesce(p_data->>'note',''));
begin
  if not coalesce((v_access->>'allowed')::boolean,false) then
    raise exception 'Accesso non autorizzato.' using errcode='42501';
  end if;
  if p_action='dashboard' then
    select jsonb_build_object('access',v_access,'applications',coalesce((
      select jsonb_agg(jsonb_build_object('id',a.id,'artist',a.artist,'title',a.title,'genre',a.genre,
        'language',a.language,'subgenre',a.subgenre,'mood',a.mood,'listeners',a.listeners,
        'spotify',coalesce(a.source_url,'https://open.spotify.com/track/'||a.spotify_id),'rights',a.rights_confirmed,
        'created',a.created_at,'status',a.status,'audioState',aa.state,'duration',aa.duration,
        'expires',aa.expires_at,'reviewable',a.status='pending' and aa.state='ready' and aa.expires_at>clock_timestamp(),
        'contestDay',t.contest_day,'requestedDay',t.requested_day,'submittedAt',a.submitted_at,'reviewNote',a.review_note,'reviewedAt',a.reviewed_at)
        order by coalesce(a.submitted_at,a.created_at),a.id)
      from public.artist_applications a left join vp_private.audio_assets aa on aa.application_id=a.id
      left join vp_private.tracks t on t.id=aa.track_id where a.removed_at is null), '[]'::jsonb),
      'accounts',case when (v_access->>'owner')::boolean then coalesce((
        select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'owner',vp_private.is_superadmin_email(u.email),'created',a.created_at,'name',p.display_name,'avatarPath',p.avatar_path,'avatarPositionX',p.avatar_position_x,'avatarPositionY',p.avatar_position_y)
          order by lower(u.email)) from auth.users u left join vp_private.admin_accounts a on a.user_id=u.id left join public.profiles p on p.id=u.id
        where u.email_confirmed_at is not null and (a.user_id is not null or vp_private.is_superadmin_email(u.email))),'[]'::jsonb)
        else '[]'::jsonb end) into v_result;
    return v_result;
  elsif p_action in ('grant','revoke') then
    if not (v_access->>'owner')::boolean then raise exception 'Solo l’amministratore principale può gestire gli accessi.' using errcode='42501'; end if;
    if p_action='grant' then
      select id into v_target from auth.users where lower(email)=lower(trim(p_data->>'email')) and email_confirmed_at is not null;
      if v_target is null then raise exception 'Questo indirizzo deve prima registrarsi e confermare la propria email.'; end if;
    else
      v_target := (p_data->>'userId')::uuid;
    end if;
    if exists(select 1 from auth.users where id=v_target and vp_private.is_superadmin_email(email)) then
      raise exception 'L’amministratore principale non può essere modificato.';
    end if;
    if p_action='grant' then
      insert into vp_private.admin_accounts(user_id,granted_by) values(v_target,v_uid) on conflict(user_id) do nothing;
    else
      delete from vp_private.admin_accounts where user_id=v_target;
    end if;
    return '{}';
  elsif p_action='preview' then
    select 'tracks/'||aa.id||'.mp3' into v_path from vp_private.audio_assets aa
      join public.artist_applications a on a.id=aa.application_id
      where a.id=(p_data->>'applicationId')::uuid and aa.state='ready'
        and (a.status='approved' or (a.status='pending' and aa.expires_at>clock_timestamp()));
    if v_path is null then raise exception 'Audio non disponibile per la revisione.'; end if;
    return jsonb_build_object('path',v_path);
  elsif p_action in ('approve','reject') then
    if p_action='approve' and coalesce(p_data->'checks','null'::jsonb)<>'[true,true,true]'::jsonb then
      raise exception 'Completa tutte le verifiche prima di approvare.';
    end if;
    if length(v_note)>1000 then raise exception 'La nota può contenere al massimo 1000 caratteri.'; end if;
    if p_action='reject' and v_note='' then raise exception 'Indica il motivo del rifiuto.'; end if;
    v_application := (p_data->>'applicationId')::uuid;
    v_result := public.audio_server(p_action,null,p_data);
    update public.artist_applications set reviewed_by=v_uid,reviewed_at=clock_timestamp(),review_note=nullif(v_note,'') where id=v_application;
    return v_result;
  end if;
  raise exception 'Operazione amministrativa non valida.';
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
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'artist', a.artist, 'title', a.title, 'listeners', a.listeners, 'genre', a.genre, 'language', a.language, 'subgenre', a.subgenre, 'mood', a.mood, 'status', a.status, 'spotify', coalesce(a.source_url, 'https://open.spotify.com/track/' || a.spotify_id), 'created', a.created_at, 'submittedAt', a.submitted_at, 'removedAt', a.removed_at, 'audioDeletedAt', a.audio_deleted_at, 'audioState', (select aa.state from vp_private.audio_assets aa where aa.application_id=a.id), 'contestDay', (select t.contest_day from vp_private.audio_assets aa join vp_private.tracks t on t.id=aa.track_id where aa.application_id=a.id)) order by a.created_at desc) from public.artist_applications a where a.user_id = v_uid), '[]'::jsonb),
    'seenReveals', coalesce((select jsonb_agg(rv.day::text) from vp_private.reveal_views rv where rv.user_id = v_uid), '[]'::jsonb)
  ) into v_profile from public.profiles p where p.id = v_uid;
  if v_profile is null then raise exception 'Profilo non disponibile.'; end if;
  select coalesce(jsonb_object_agg(day::text, payload), '{}'::jsonb) into v_rounds from (
    select s.day, jsonb_build_object('day', s.day::text, 'ids', jsonb_agg(s.id order by s.slot),
      'listened', coalesce(jsonb_agg(s.id order by s.slot) filter(where s.completed_at is not null), '[]'::jsonb),
      'vote', (select v.selection_id from vp_private.votes v where v.user_id = v_uid and v.day = s.day), 'completionVersion', 2) payload
    from vp_private.daily_selections s where s.user_id = v_uid and s.track_id in(select t.id from vp_private.tracks t join vp_private.artists a on a.id=t.artist_id where not t.is_demo and not a.is_demo) group by s.day
  ) rounds;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'day', s.day, 'slot', s.slot, 'revealed', v_now >= c.closes_at, 'genre', t.genre, 'mood', t.mood, 'lang', t.language, 'duration', t.duration_seconds, 'isDemo', t.is_demo,
    'title', case when v_now >= c.closes_at then t.title else null end, 'artist', case when v_now >= c.closes_at then a.name else null end,
    'spotifyUrl', case when v_now >= c.closes_at then coalesce(t.source_url, t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id) else null end,
    'saved', exists(select 1 from vp_private.favorites f where f.user_id = v_uid and f.track_id = t.id)) order by s.day, s.slot), '[]'::jsonb) into v_tracks
  from vp_private.daily_selections s join vp_private.contests c on c.day = s.day join vp_private.tracks t on t.id = s.track_id join vp_private.artists a on a.id = t.artist_id
  where s.user_id = v_uid and not t.is_demo and not a.is_demo;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'day', s.day, 'slot', s.slot,
    'revealed', coalesce(v_now >= c.closes_at,false),
    'title', case when v_now >= c.closes_at then t.title end,
    'artist', case when v_now >= c.closes_at then a.name end,
    'genre', t.genre, 'isDemo', t.is_demo,
    'spotifyUrl', case when v_now >= c.closes_at then coalesce(t.source_url,t.demo_spotify_url,'https://open.spotify.com/track/'||t.spotify_id) end)
    order by f.created_at desc),'[]'::jsonb) into v_favorites
  from vp_private.favorites f join vp_private.tracks t on t.id=f.track_id join vp_private.artists a on a.id=t.artist_id
  left join vp_private.daily_selections s on s.id=f.selection_id and s.user_id=v_uid
  left join vp_private.contests c on c.day=s.day
  where f.user_id=v_uid and not t.is_demo and not a.is_demo;
  return jsonb_build_object('profile', v_profile || jsonb_build_object('rounds', v_rounds, 'saved', (select coalesce(jsonb_agg(item->'id'), '[]'::jsonb) from jsonb_array_elements(v_favorites) item)),
    'tracks', v_tracks, 'favorites', v_favorites, 'clock', jsonb_build_object('day', v_day::text, 'seconds', extract(hour from v_now at time zone 'Europe/Rome') * 3600 + extract(minute from v_now at time zone 'Europe/Rome') * 60 + extract(second from v_now at time zone 'Europe/Rome'), 'revealed', v_now >= (v_day + time '21:00') at time zone 'Europe/Rome'), 'serverTime', v_now);
end;
$$;

insert into supabase_migrations.schema_migrations(version,name) values ('20261009000200','favorites_and_application_history') on conflict(version) do nothing;
commit;
