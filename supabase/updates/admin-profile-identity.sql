-- UNA VOLTA sul progetto esistente, dopo admin-application-links.sql.
begin;
-- Identità corrente degli account admin; aggiunta e revoca restano basate su email/ID.
-- URL immagine versionati: sostituire un avatar non riutilizza una copia in cache.
create or replace function public.set_avatar_path(p_path text) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := vp_private.require_user();
begin
  if p_path is not null and p_path !~ ('^' || v_uid::text || '/profile(-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\.(jpg|png|webp|gif)$') then
    raise exception 'Percorso immagine non valido.';
  end if;
  update public.profiles set avatar_path=p_path,updated_at=clock_timestamp() where id=v_uid;
  if not found then raise exception 'Profilo non disponibile.'; end if;
end;
$$;
revoke all on function public.set_avatar_path(text) from public,anon;
grant execute on function public.set_avatar_path(text) to authenticated;

-- Bypass RLS limitato alla verifica dell'avatar corrente di un admin confermato.
create function public.can_view_admin_avatar(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((public.get_admin_access()->>'owner')::boolean,false)
    and exists (
      select 1 from public.profiles p
      join auth.users u on u.id=p.id
      left join vp_private.admin_accounts a on a.user_id=u.id
      where p.avatar_path=p_path and u.email_confirmed_at is not null
        and (a.user_id is not null or lower(u.email)='santonithomas9@gmail.com')
    );
$$;
revoke all on function public.can_view_admin_avatar(text) from public,anon;
grant execute on function public.can_view_admin_avatar(text) to authenticated;

do $$ begin
  if to_regclass('storage.objects') is not null then
    create policy avatar_select_admin_identity on storage.objects
      for select to authenticated
      using (bucket_id='nextwave-avatars' and public.can_view_admin_avatar(name));
  end if;
end $$;

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
        select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'owner',lower(u.email)='santonithomas9@gmail.com','created',a.created_at,'name',p.display_name,'avatarPath',p.avatar_path,'avatarPositionX',p.avatar_position_x,'avatarPositionY',p.avatar_position_y)
          order by lower(u.email)) from auth.users u left join vp_private.admin_accounts a on a.user_id=u.id left join public.profiles p on p.id=u.id
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

insert into supabase_migrations.schema_migrations(version,name) values ('20261008000300','admin_profile_identity') on conflict(version) do nothing;
commit;
