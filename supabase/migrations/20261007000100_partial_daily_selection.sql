-- Da uno a cinque brani reali: un catalogo piccolo non deve nascondere le candidature approvate.
create or replace function vp_private.ensure_daily_selection(p_uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (clock_timestamp() at time zone 'Europe/Rome')::date;
  v_count integer;
  v_onboarded boolean;
begin
  select onboarded into v_onboarded from public.profiles where id=p_uid for update;
  if not v_onboarded then return; end if;
  -- Una selezione già assegnata rimane stabile per l'intera giornata.
  if exists(select 1 from vp_private.daily_selections where user_id=p_uid and day=v_day) then return; end if;
  if clock_timestamp() >= (v_day+time '21:00') at time zone 'Europe/Rome' then return; end if;
  select count(*) into v_count from vp_private.tracks t join vp_private.artists a on a.id=t.artist_id
    join public.user_preferences p on p.genre=t.genre and p.user_id=p_uid
    where not t.is_demo and not a.is_demo and t.active and t.audio_deleted_at is null
      and t.audio_path is not null and (t.contest_day is null or t.contest_day=v_day)
      and a.eligibility_verified_at is not null and a.monthly_listeners<10000;
  if v_count=0 then return; end if;
  insert into vp_private.contests(day,closes_at) values(v_day,(v_day+time '21:00') at time zone 'Europe/Rome') on conflict do nothing;
  with candidates as (
    select t.id,-ln(greatest(random(),0.000000001))*(1+(select count(*) from vp_private.daily_selections s where s.track_id=t.id)) as weight
    from vp_private.tracks t join vp_private.artists a on a.id=t.artist_id
    join public.user_preferences p on p.genre=t.genre and p.user_id=p_uid
    where not t.is_demo and not a.is_demo and t.active and t.audio_deleted_at is null
      and t.audio_path is not null and (t.contest_day is null or t.contest_day=v_day)
      and a.eligibility_verified_at is not null and a.monthly_listeners<10000
  ), chosen as(select id,weight from candidates order by weight limit 5)
  insert into vp_private.daily_selections(user_id,day,slot,track_id)
    select p_uid,v_day,row_number() over(order by weight)::smallint,id from chosen;
end;
$$;

create or replace function public.cast_vote(p_selection uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'Europe/Rome')::date;
  v_total integer;
  v_completed integer;
begin
  perform 1 from public.profiles where id=v_uid for update;
  if v_now >= (v_day+time '21:00') at time zone 'Europe/Rome' then raise exception 'Il voto si è chiuso alle 21:00.'; end if;
  if not exists(select 1 from vp_private.daily_selections s join vp_private.tracks t on t.id=s.track_id
    join vp_private.artists a on a.id=t.artist_id where s.id=p_selection and s.user_id=v_uid and s.day=v_day and not t.is_demo and not a.is_demo)
    then raise exception 'Brano non disponibile.'; end if;
  select count(*),count(s.completed_at) into v_total,v_completed from vp_private.daily_selections s
    join vp_private.tracks t on t.id=s.track_id join vp_private.artists a on a.id=t.artist_id
    where s.user_id=v_uid and s.day=v_day and not t.is_demo and not a.is_demo;
  if v_total<1 or v_total>5 or v_completed<>v_total then raise exception 'Completa tutti i brani della tua selezione.'; end if;
  insert into vp_private.votes(user_id,day,selection_id) values(v_uid,v_day,p_selection);
exception when unique_violation then raise exception 'Hai già votato oggi.';
end;
$$;
