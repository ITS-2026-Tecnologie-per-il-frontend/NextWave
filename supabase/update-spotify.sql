-- Solo aggiornamento Spotify: eseguire UNA VOLTA sul progetto esistente.
begin;
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

insert into supabase_migrations.schema_migrations(version,name) values ('20261006000100','spotify');
commit;

