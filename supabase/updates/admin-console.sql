-- UNA VOLTA sul progetto esistente, dopo temporary-audio.sql.
-- Aggiunge il pannello admin e protegge il superadmin.
begin;
-- Accesso amministrativo verificato nel database, mai da dati modificabili dal browser.
create table vp_private.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);
alter table vp_private.admin_accounts enable row level security;
revoke all on vp_private.admin_accounts from public, anon, authenticated;

create function vp_private.protect_superadmin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if lower(old.email)='santonithomas9@gmail.com' then
    if TG_OP='DELETE' then raise exception 'Il superadmin non può essere eliminato.'; end if;
    if lower(new.email) is distinct from lower(old.email) then
      raise exception 'L’email del superadmin non può essere modificata.';
    end if;
  end if;
  if TG_OP='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function vp_private.protect_superadmin() from public, anon, authenticated;
create trigger protect_nextwave_superadmin before delete or update of email on auth.users
  for each row execute function vp_private.protect_superadmin();

alter table public.artist_applications add column reviewed_by uuid references auth.users(id);
alter table public.artist_applications add column reviewed_at timestamptz;
alter table public.artist_applications add column review_note text;

create function public.get_admin_access() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_owner boolean;
  v_allowed boolean;
begin
  select exists(select 1 from auth.users where id=v_uid and email_confirmed_at is not null
    and lower(email)='santonithomas9@gmail.com') into v_owner;
  select v_owner or exists(select 1 from vp_private.admin_accounts a join auth.users u on u.id=a.user_id
    where a.user_id=v_uid and u.email_confirmed_at is not null) into v_allowed;
  return jsonb_build_object('allowed',v_allowed,'owner',v_owner);
end;
$$;
revoke all on function public.get_admin_access() from public, anon;
grant execute on function public.get_admin_access() to authenticated;

create function public.admin_console(p_action text, p_data jsonb default '{}'::jsonb) returns jsonb
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
        'contestDay',t.contest_day,'reviewNote',a.review_note,'reviewedAt',a.reviewed_at)
        order by a.created_at desc)
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

insert into supabase_migrations.schema_migrations(version,name) values ('20261006000400','admin_console') on conflict(version) do nothing;
commit;
