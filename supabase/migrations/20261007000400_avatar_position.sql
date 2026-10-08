alter table public.profiles
  add column avatar_position_x smallint not null default 50
    check (avatar_position_x between 0 and 100),
  add column avatar_position_y smallint not null default 50
    check (avatar_position_y between 0 and 100);

create function public.get_avatar_settings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_x smallint;
  v_y smallint;
begin
  select avatar_position_x, avatar_position_y into v_x, v_y
  from public.profiles where id=v_uid;
  if not found then raise exception 'Profilo non disponibile.'; end if;
  return jsonb_build_object('x', v_x, 'y', v_y);
end;
$$;

create function public.set_avatar_position(p_x integer, p_y integer) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := vp_private.require_user();
begin
  if p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then
    raise exception 'Inquadratura non valida.';
  end if;
  update public.profiles set avatar_position_x=p_x, avatar_position_y=p_y,
    updated_at=clock_timestamp() where id=v_uid;
  if not found then raise exception 'Profilo non disponibile.'; end if;
end;
$$;

revoke all on function public.get_avatar_settings(), public.set_avatar_position(integer,integer)
  from public, anon;
grant execute on function public.get_avatar_settings(), public.set_avatar_position(integer,integer)
  to authenticated;
