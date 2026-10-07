-- Coda cronologica delle candidature approvate, cinque posti per genere e giorno.
alter table vp_private.tracks add column requested_day date;
update vp_private.tracks set requested_day=contest_day
where not is_demo and contest_day>(clock_timestamp() at time zone 'Europe/Rome')::date;

create function vp_private.schedule_genre(p_genre text) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_today date := (clock_timestamp() at time zone 'Europe/Rome')::date;
  v_track record;
  v_day date;
begin
  -- Anche approvazioni simultanee condividono la stessa coda.
  perform pg_advisory_xact_lock(hashtextextended('nextwave-queue:'||p_genre,0));
  -- Liberiamo solo i giorni futuri; nessun contest iniziato viene modificato.
  update vp_private.tracks set contest_day=null where genre=p_genre and requested_day is not null
    and contest_day>v_today and active and not is_demo and audio_deleted_at is null;
  for v_track in
    select t.id,t.requested_day from vp_private.tracks t
    left join vp_private.audio_assets aa on aa.track_id=t.id
    left join public.artist_applications a on a.id=aa.application_id
    where t.genre=p_genre and t.requested_day is not null and t.contest_day is null
      and t.active and not t.is_demo and t.audio_deleted_at is null
    order by coalesce(a.submitted_at,a.created_at,t.created_at),t.id
  loop
    v_day:=greatest(v_track.requested_day,v_today+1);
    while (select count(*) from vp_private.tracks where genre=p_genre and contest_day=v_day
      and active and not is_demo and audio_deleted_at is null)>=5 loop
      v_day:=v_day+1;
    end loop;
    update vp_private.tracks set contest_day=v_day where id=v_track.id;
    -- L'audio resta disponibile fino alla fine del giorno effettivo assegnato.
    update vp_private.audio_assets set expires_at=(v_day+time '21:00') at time zone 'Europe/Rome'
      where track_id=v_track.id and state='ready';
  end loop;
end;
$$;
revoke all on function vp_private.schedule_genre(text) from public,anon,authenticated;

-- Allineiamo le sole programmazioni future già esistenti.
do $$ declare v_genre text; begin
  for v_genre in select distinct genre from vp_private.tracks where requested_day is not null
  loop perform vp_private.schedule_genre(v_genre); end loop;
end $$;

create or replace function public.save_profile(p_name text,p_theme text,p_genres text[],p_onboarded boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid := vp_private.require_user();
begin
  if p_genres is null or cardinality(p_genres)<1 or cardinality(p_genres)>5
    or exists(select 1 from unnest(p_genres) genre where genre is null
      or not exists(select 1 from public.genres g where g.name=genre))
  then raise exception 'Scegli da 1 a 5 generi validi.'; end if;
  update public.profiles set display_name=trim(p_name),theme=p_theme,
    onboarded=p_onboarded,updated_at=clock_timestamp() where id=v_uid;
  if not found then raise exception 'Profilo non disponibile.'; end if;
  delete from public.user_preferences where user_id=v_uid;
  insert into public.user_preferences(user_id,genre) select v_uid,distinct_genre
    from (select distinct unnest(p_genres) as distinct_genre) preferences;
end;
$$;

create or replace function vp_private.ensure_daily_selection(p_uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_day date := (clock_timestamp() at time zone 'Europe/Rome')::date;
  v_onboarded boolean;
  v_preferences integer;
begin
  select onboarded into v_onboarded from public.profiles where id=p_uid for update;
  if not v_onboarded then return; end if;
  if exists(select 1 from vp_private.daily_selections where user_id=p_uid and day=v_day) then return; end if;
  if clock_timestamp()>=(v_day+time '21:00') at time zone 'Europe/Rome' then return; end if;
  select count(*) into v_preferences from public.user_preferences where user_id=p_uid;
  -- I vecchi account con più di cinque gusti devono scegliere quali mantenere.
  if v_preferences<1 or v_preferences>5 then return; end if;
  insert into vp_private.contests(day,closes_at) values(v_day,(v_day+time '21:00') at time zone 'Europe/Rome') on conflict do nothing;
  with eligible as (
    select t.id,t.genre,coalesce(ap.submitted_at,ap.created_at,t.created_at) as submitted,
      row_number() over(partition by t.genre order by coalesce(ap.submitted_at,ap.created_at,t.created_at),t.id) as genre_rank
    from vp_private.tracks t join vp_private.artists a on a.id=t.artist_id
    join public.user_preferences p on p.genre=t.genre and p.user_id=p_uid
    left join vp_private.audio_assets aa on aa.track_id=t.id
    left join public.artist_applications ap on ap.id=aa.application_id
    where not t.is_demo and not a.is_demo and t.active and t.audio_deleted_at is null
      and t.audio_path is not null and (t.contest_day=v_day or (t.contest_day is null and t.requested_day is null))
      and a.eligibility_verified_at is not null and a.monthly_listeners<10000
  ), candidates as (
    select *,random() as draw from eligible where genre_rank<=5
  ), chosen as (
    select *,row_number() over(order by
      case when v_preferences=1 then submitted end,
      case when v_preferences>1 then draw end,id) as slot
    from candidates
  )
  insert into vp_private.daily_selections(user_id,day,slot,track_id)
    select p_uid,v_day,slot::smallint,id from chosen where slot<=5;
end;
$$;

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
    insert into public.artist_applications(user_id,artist,title,listeners,genre,language,subgenre,mood,spotify_id,rights_confirmed)
    values(p_user,trim(p_data->>'artist'),trim(p_data->>'title'),(p_data->>'listeners')::integer,p_data->>'genre',p_data->>'language',trim(p_data->>'subgenre'),p_data->>'mood',p_data->>'spotifyId',true)
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
      'spotify','https://open.spotify.com/track/'||a.spotify_id,'audioId',aa.id,'duration',aa.duration,'expires',aa.expires_at,'path','tracks/'||aa.id||'.mp3') order by a.created_at),'[]') into v_result
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
    insert into vp_private.tracks(artist_id,title,genre,mood,language,audio_path,duration_seconds,spotify_id,rights_verified_at,active,contest_day)
    values(v_artist,v_application.title,v_application.genre,v_application.mood,v_application.language,'storage://nextwave-audio/tracks/'||v_asset.id||'.mp3',v_asset.duration,v_application.spotify_id,clock_timestamp(),true,v_day) returning id into v_track;
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
        'spotify','https://open.spotify.com/track/'||a.spotify_id,'rights',a.rights_confirmed,
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
revoke all on function public.admin_console(text,jsonb) from public, anon;
grant execute on function public.admin_console(text,jsonb) to authenticated;

