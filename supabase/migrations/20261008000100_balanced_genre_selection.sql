-- Ripartizione dei cinque slot tra i generi preferiti; non modifica selezioni esistenti.
create or replace function vp_private.ensure_daily_selection(p_uid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_day date := (clock_timestamp() at time zone 'Europe/Rome')::date;
  v_onboarded boolean;
  v_preferences integer;
  v_candidates uuid[];
  v_chosen uuid[] := '{}'::uuid[];
  v_today jsonb := '{}'::jsonb;
  v_history jsonb := '{}'::jsonb;
  v_genre text;
  v_track uuid;
begin
  -- La stessa serratura serializza estrazioni e cambi di preferenze dell'utente.
  select onboarded into v_onboarded from public.profiles where id=p_uid for update;
  if not coalesce(v_onboarded,false) then return; end if;
  if exists(select 1 from vp_private.daily_selections where user_id=p_uid and day=v_day) then return; end if;
  if clock_timestamp()>=(v_day+time '21:00') at time zone 'Europe/Rome' then return; end if;
  select count(*) into v_preferences from public.user_preferences where user_id=p_uid;
  if v_preferences<1 or v_preferences>5 then return; end if;

  -- La coda resta cronologica: al massimo i primi cinque candidati di ogni genere.
  with eligible as (
    select t.id,t.genre,
      row_number() over(partition by t.genre order by coalesce(ap.submitted_at,ap.created_at,t.created_at),t.id) as genre_rank
    from vp_private.tracks t join vp_private.artists a on a.id=t.artist_id
    join public.user_preferences p on p.genre=t.genre and p.user_id=p_uid
    left join vp_private.audio_assets aa on aa.track_id=t.id
    left join public.artist_applications ap on ap.id=aa.application_id
    where not t.is_demo and not a.is_demo and t.active and t.audio_deleted_at is null
      and t.audio_path is not null and (t.contest_day=v_day or (t.contest_day is null and t.requested_day is null))
      and a.eligibility_verified_at is not null and a.monthly_listeners<10000
  )
  select coalesce(array_agg(id order by random()),'{}'::uuid[]) into v_candidates
    from eligible where genre_rank<=5;
  if cardinality(v_candidates)=0 then return; end if;

  -- Conta assegnazioni reali nei giorni precedenti, anche se non completate.
  -- Nessun peso di esposizione globale influenza il sorteggio dei singoli brani.
  select coalesce(jsonb_object_agg(h.genre,h.total),'{}'::jsonb) into v_history
  from (
    select t.genre,count(*) as total from vp_private.daily_selections s
    join vp_private.tracks t on t.id=s.track_id
    join vp_private.artists a on a.id=t.artist_id
    join public.user_preferences p on p.user_id=p_uid and p.genre=t.genre
    where s.user_id=p_uid and s.day<v_day and not t.is_demo and not a.is_demo
    group by t.genre
  ) h;

  while cardinality(v_chosen)<5 loop
    -- Bilancia prima il giorno corrente. A parità, ruota gli extra usando lo storico.
    -- L'ultimo spareggio è stabile per utente e indipendente dall'ordine dei gusti.
    select t.genre into v_genre from vp_private.tracks t
    where t.id=any(v_candidates) and not t.id=any(v_chosen)
    group by t.genre
    order by coalesce((v_today->>t.genre)::integer,0),
      coalesce((v_history->>t.genre)::bigint,0),md5(p_uid::text||':'||t.genre),t.genre
    limit 1;
    if not found then exit; end if;
    select c.id into v_track from unnest(v_candidates) with ordinality c(id,position)
    join vp_private.tracks t on t.id=c.id
    where t.genre=v_genre and not c.id=any(v_chosen)
    order by c.position limit 1;
    v_chosen:=array_append(v_chosen,v_track);
    v_today:=jsonb_set(v_today,array[v_genre],to_jsonb(coalesce((v_today->>v_genre)::integer,0)+1));
    v_history:=jsonb_set(v_history,array[v_genre],to_jsonb(coalesce((v_history->>v_genre)::bigint,0)+1));
  end loop;

  insert into vp_private.contests(day,closes_at)
    values(v_day,(v_day+time '21:00') at time zone 'Europe/Rome') on conflict do nothing;
  insert into vp_private.daily_selections(user_id,day,slot,track_id)
    select p_uid,v_day,c.position::smallint,c.id from unnest(v_chosen) with ordinality c(id,position);
end;
$$;
revoke all on function vp_private.ensure_daily_selection(uuid) from public,anon,authenticated;
