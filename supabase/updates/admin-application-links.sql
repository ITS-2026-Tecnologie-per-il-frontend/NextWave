-- UNA VOLTA sul progetto esistente, dopo balanced-genre-selection.sql.
begin;
-- Link esterni consentiti soltanto agli account admin verificati nel database.
alter table public.artist_applications add column source_url text;
alter table public.artist_applications alter column spotify_id drop not null;
alter table vp_private.tracks add column source_url text;
create unique index applications_pending_source_idx on public.artist_applications(user_id,source_url) where status='pending' and source_url is not null;

create function vp_private.check_application_link() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_match text[];
begin
  if new.source_url is null then
    if new.spotify_id is null then raise exception 'Inserisci un link valido al brano.'; end if;
    return new;
  end if;
  new.source_url:=trim(new.source_url);
  if length(new.source_url)>2048 or new.source_url !~ '^https?://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$' then
    raise exception 'Inserisci un link valido al brano (HTTP o HTTPS).';
  end if;
  v_match:=regexp_match(new.source_url,'^https://open[.]spotify[.]com/(?:intl-[a-z]{2}/)?track/([A-Za-z0-9]{22})/?(?:[?#].*)?$');
  if v_match is null and not vp_private.is_admin(new.user_id) then
    raise exception 'Inserisci un link Spotify valido a un brano.';
  end if;
  new.spotify_id:=v_match[1];
  return new;
end;
$$;
revoke all on function vp_private.check_application_link() from public,anon,authenticated;
create trigger check_application_link before insert or update of source_url,spotify_id,user_id on public.artist_applications
  for each row execute function vp_private.check_application_link();

create or replace function public.audio_server(p_action text, p_user uuid default null, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_asset vp_private.audio_assets%rowtype;
  v_application public.artist_applications%rowtype;
  v_id uuid; v_artist uuid; v_track uuid; v_result jsonb; v_day date;
begin
  if p_action='reserve' then
    if p_user is null or not exists(select 1 from public.profiles where id=p_user) then raise exception 'Accesso richiesto.'; end if;
    -- Riserviamo 10 MB per candidatura, indipendentemente dalla dimensione dichiarata dal browser.
    -- 400 MB lasciano spazio alla copia originale temporanea e ai campioni demo.
    perform pg_advisory_xact_lock(601006003);
    if (select count(*) from vp_private.audio_assets where state<>'deleted' or raw_deleted_at is null) >= 40 then
      raise exception 'Spazio temporaneamente esaurito. Riprova dopo il contest.';
    end if;
    if exists(select 1 from vp_private.audio_assets where user_id=p_user and state in ('uploading','processing') and upload_expires_at>clock_timestamp() and exists(select 1 from public.artist_applications where id=application_id and status='pending')) then
      raise exception 'Hai già un caricamento in corso. Completalo o attendi la sua scadenza.';
    end if;
    if coalesce((p_data->>'rights')::boolean,false) is not true then raise exception 'Conferma l’autorizzazione alla riproduzione.'; end if;
    insert into public.artist_applications(user_id,artist,title,listeners,genre,language,subgenre,mood,spotify_id,source_url,rights_confirmed)
    values(p_user,trim(p_data->>'artist'),trim(p_data->>'title'),(p_data->>'listeners')::integer,p_data->>'genre',p_data->>'language',trim(p_data->>'subgenre'),p_data->>'mood',p_data->>'spotifyId',nullif(trim(p_data->>'spotify'),''),true)
    returning id into v_id;
    insert into vp_private.audio_assets(application_id,user_id) values(v_id,p_user) returning * into v_asset;
    return jsonb_build_object('id',v_asset.id,'path','uploads/'||v_asset.id||'.mp3');
  elsif p_action='claim-upload' then
    select * into v_asset from vp_private.audio_assets where id=(p_data->>'id')::uuid and user_id=p_user for update;
    if not found or v_asset.upload_expires_at<=clock_timestamp()+interval '5 minutes' then raise exception 'Caricamento scaduto. Ripeti la candidatura.'; end if;
    if not exists(select 1 from public.artist_applications where id=v_asset.application_id and status='pending') then raise exception 'Caricamento annullato.'; end if;
    if v_asset.state='ready' then return jsonb_build_object('ready',true); end if;
    if v_asset.state<>'uploading' and not (v_asset.state='processing' and v_asset.processing_at<clock_timestamp()-interval '5 minutes') then raise exception 'Caricamento già in elaborazione.'; end if;
    update vp_private.audio_assets set state='processing',processing_at=clock_timestamp() where id=v_asset.id;
    return jsonb_build_object('id',v_asset.id,'path','uploads/'||v_asset.id||'.mp3','target','tracks/'||v_asset.id||'.mp3');
  elsif p_action='complete-upload' then
    select * into v_asset from vp_private.audio_assets where id=(p_data->>'id')::uuid and user_id=p_user for update;
    if not found or v_asset.state<>'processing' or v_asset.upload_expires_at<=clock_timestamp() then raise exception 'Caricamento non disponibile.'; end if;
    if not exists(select 1 from public.artist_applications where id=v_asset.application_id and status='pending') then raise exception 'Caricamento annullato.'; end if;
    if not ((p_data->>'duration')::double precision>0 and (p_data->>'duration')::double precision<=1800) then raise exception 'Durata audio non valida.'; end if;
    update vp_private.audio_assets set state='ready',bytes=(p_data->>'bytes')::bigint,duration=(p_data->>'duration')::double precision,
      expires_at=clock_timestamp()+interval '7 days' where id=v_asset.id;
    return jsonb_build_object('applicationId',v_asset.application_id);
  elsif p_action='retry-upload' then
    update vp_private.audio_assets set state='uploading',processing_at=null
      where id=(p_data->>'id')::uuid and user_id=p_user and state='processing';
    return '{}';
  elsif p_action='cancel-upload' then
    update public.artist_applications set status='rejected' where id in
      (select application_id from vp_private.audio_assets where id=(p_data->>'id')::uuid and user_id=p_user and state in ('uploading','processing'));
    update vp_private.audio_assets set expires_at=upload_expires_at where id=(p_data->>'id')::uuid and user_id=p_user and state in ('uploading','processing');
    return '{}';
  elsif p_action='review-list' then
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'artist',a.artist,'title',a.title,'genre',a.genre,'listeners',a.listeners,
      'spotify',coalesce(a.source_url,'https://open.spotify.com/track/'||a.spotify_id),'audioId',aa.id,'duration',aa.duration,'expires',aa.expires_at,'path','tracks/'||aa.id||'.mp3') order by a.created_at),'[]') into v_result
      from public.artist_applications a join vp_private.audio_assets aa on aa.application_id=a.id
      where a.status='pending' and aa.state='ready' and aa.expires_at>clock_timestamp();
    return v_result;
  elsif p_action in ('approve','reject') then
    perform pg_advisory_xact_lock(hashtextextended('nextwave-queue:'||genre,0))
      from public.artist_applications where id=(p_data->>'applicationId')::uuid;
    select * into v_asset from vp_private.audio_assets where application_id=(p_data->>'applicationId')::uuid for update;
    if not found or v_asset.state<>'ready' or v_asset.expires_at<=clock_timestamp() then raise exception 'Audio non pronto o scaduto.'; end if;
    select * into v_application from public.artist_applications where id=v_asset.application_id for update;
    if v_application.status<>'pending' then raise exception 'Candidatura già esaminata.'; end if;
    if p_action='reject' then
      update public.artist_applications set status='rejected' where id=v_application.id;
      update vp_private.audio_assets set expires_at=clock_timestamp() where id=v_asset.id;
      return '{}';
    end if;
    v_day:=(p_data->>'day')::date;
    if v_day is null or v_day<=(clock_timestamp() at time zone 'Europe/Rome')::date or v_day>(clock_timestamp() at time zone 'Europe/Rome')::date+30 then raise exception 'Scegli un contest futuro entro 30 giorni.'; end if;
    insert into vp_private.artists(name,monthly_listeners,eligibility_verified_at) values(v_application.artist,v_application.listeners,clock_timestamp()) returning id into v_artist;
    insert into vp_private.tracks(artist_id,title,genre,mood,language,audio_path,duration_seconds,spotify_id,source_url,rights_verified_at,active,contest_day)
    values(v_artist,v_application.title,v_application.genre,v_application.mood,v_application.language,'storage://nextwave-audio/tracks/'||v_asset.id||'.mp3',v_asset.duration,v_application.spotify_id,v_application.source_url,clock_timestamp(),true,v_day) returning id into v_track;
    update public.artist_applications set status='approved' where id=v_application.id;
    update vp_private.audio_assets set track_id=v_track,expires_at=(v_day+time '21:00') at time zone 'Europe/Rome' where id=v_asset.id;
    update vp_private.tracks set requested_day=v_day where id=v_track;
    perform vp_private.schedule_genre(v_application.genre);
    select contest_day into v_day from vp_private.tracks where id=v_track;
    return jsonb_build_object('trackId',v_track,'contestDay',v_day);
  elsif p_action='cleanup-list' then
    -- Disattivazione prima della cancellazione: non possono nascere nuove selezioni del file.
    with expired as (
      select a.id from vp_private.audio_assets a where a.state not in ('deleted','deleting') and a.expires_at<=clock_timestamp()
      and not exists(select 1 from vp_private.daily_selections s join vp_private.contests c on c.day=s.day where s.track_id=a.track_id and c.closes_at>clock_timestamp())
      order by a.expires_at limit 20 for update skip locked
    ) update vp_private.audio_assets set state='deleting' where id in(select id from expired);
    update vp_private.tracks set active=false where id in(select track_id from vp_private.audio_assets where state='deleting');
    select coalesce(jsonb_agg(job),'[]') into v_result from (
      select jsonb_build_object('id',id,'kind','audio','path','tracks/'||id||'.mp3') job from vp_private.audio_assets where state='deleting'
      union all
      select jsonb_build_object('id',id,'kind','raw','path','uploads/'||id||'.mp3') job from vp_private.audio_assets
      where upload_expires_at<=clock_timestamp() and raw_deleted_at is null
    ) jobs;
    return v_result;
  elsif p_action='cleanup-done' then
    if p_data->>'kind'='raw' then
      update vp_private.audio_assets set raw_deleted_at=clock_timestamp() where id=(p_data->>'id')::uuid and upload_expires_at<=clock_timestamp();
    else
      select * into v_asset from vp_private.audio_assets where id=(p_data->>'id')::uuid and state='deleting' for update;
      if not found then return '{}'; end if;
      update vp_private.audio_assets set state='deleted',deleted_at=clock_timestamp() where id=v_asset.id;
      update public.artist_applications set audio_deleted_at=clock_timestamp(),status=case when status='pending' then 'rejected' else status end where id=v_asset.application_id;
      update vp_private.tracks set audio_path=null,audio_deleted_at=clock_timestamp(),active=false where id=v_asset.track_id;
    end if;
    return '{}';
  elsif p_action='demo-ready' then
    -- Solo il migratore amministrativo chiama questa operazione dopo aver caricato i cinque file.
    update vp_private.tracks set audio_path='storage://nextwave-audio/demo/'||substring(audio_path from '/audio/([0-4])\.wav')||'.wav',
      demo_spotify_url='https://open.spotify.com/intl-it/track/7iNLydOMjLLb7BiwkdoPDU?si=ec454f9d3d2a4fdf'
      where is_demo and audio_path ~ '^/audio/[0-4]\.wav$';
    return '{}';
  end if;
  raise exception 'Operazione audio non valida.';
end;
$$;

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
      left join vp_private.tracks t on t.id=aa.track_id), '[]'::jsonb),
      'accounts',case when (v_access->>'owner')::boolean then coalesce((
        select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'owner',lower(u.email)='santonithomas9@gmail.com','created',a.created_at)
          order by lower(u.email)) from auth.users u left join vp_private.admin_accounts a on a.user_id=u.id
        where u.email_confirmed_at is not null and (a.user_id is not null or lower(u.email)='santonithomas9@gmail.com')),'[]'::jsonb)
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
    if exists(select 1 from auth.users where id=v_target and lower(email)='santonithomas9@gmail.com') then
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
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'artist', a.name, 'genre', t.genre, 'isDemo', t.is_demo, 'spotifyUrl', coalesce(t.source_url, t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id)) order by f.created_at desc), '[]'::jsonb) into v_favorites
  from vp_private.favorites f join vp_private.tracks t on t.id = f.track_id join vp_private.artists a on a.id = t.artist_id where f.user_id = v_uid and not t.is_demo and not a.is_demo;
  return jsonb_build_object('profile', v_profile || jsonb_build_object('rounds', v_rounds, 'saved', (select coalesce(jsonb_agg(item->'id'), '[]'::jsonb) from jsonb_array_elements(v_favorites) item)),
    'tracks', v_tracks, 'favorites', v_favorites, 'clock', jsonb_build_object('day', v_day::text, 'seconds', extract(hour from v_now at time zone 'Europe/Rome') * 3600 + extract(minute from v_now at time zone 'Europe/Rome') * 60 + extract(second from v_now at time zone 'Europe/Rome'), 'revealed', v_now >= (v_day + time '21:00') at time zone 'Europe/Rome'), 'serverTime', v_now);
end;
$$;

create or replace function vp_private.ranking_rows(p_start date, p_end date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with exposures as (
    select s.track_id, count(*) as total from vp_private.daily_selections s where s.day between p_start and p_end group by s.track_id
  ), votes as (
    select s.track_id, count(*) as total from vp_private.votes v join vp_private.daily_selections s on s.id = v.selection_id where v.day between p_start and p_end group by s.track_id
  ), rows as (
    select t.id, t.title, a.name as artist, t.genre, t.is_demo as "isDemo", coalesce(t.source_url, t.demo_spotify_url, 'https://open.spotify.com/track/' || t.spotify_id) as "spotifyUrl", e.total as exposures, coalesce(v.total, 0) as votes,
      coalesce(v.total, 0)::double precision / e.total as score
    from vp_private.tracks t join vp_private.artists a on a.id = t.artist_id join exposures e on e.track_id = t.id left join votes v on v.track_id = t.id where not t.is_demo and not a.is_demo
  ) select coalesce(jsonb_agg(to_jsonb(rows) order by score desc, exposures desc, id), '[]'::jsonb) from rows;
$$;


insert into supabase_migrations.schema_migrations(version,name) values ('20261008000200','admin_application_links') on conflict(version) do nothing;
commit;
