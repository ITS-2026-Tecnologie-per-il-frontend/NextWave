-- Eseguire UNA VOLTA dopo setup-demo.sql, gia applicato.
begin;
-- Il credito totale non puo superare la durata reale della sessione.
-- Questo blocca l'accumulo di tolleranze con molte richieste ravvicinate.
alter table vp_private.listening_sessions add column started_at timestamptz not null default clock_timestamp();

create or replace function public.listening_progress(p_session uuid, p_position double precision, p_finish boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vp_private.require_user();
  v_now timestamptz := clock_timestamp();
  v_session vp_private.listening_sessions%rowtype;
  v_duration double precision;
  v_delta double precision;
  v_elapsed double precision;
  v_credit double precision;
begin
  select * into v_session from vp_private.listening_sessions where id = p_session and user_id = v_uid for update;
  if not found or v_session.day <> (v_now at time zone 'Europe/Rome')::date or v_session.expires_at <= v_now
  then raise exception 'Sessione scaduta. Riavvia il brano.'; end if;
  if v_session.completed_at is not null then return jsonb_build_object('completed', true); end if;
  select t.duration_seconds into v_duration from vp_private.daily_selections s join vp_private.tracks t on t.id = s.track_id where s.id = v_session.selection_id;
  if p_position is null or not (p_position >= 0 and p_position <= v_duration + 0.25) then raise exception 'Posizione audio non valida.'; end if;
  v_delta := p_position - v_session.last_position;
  v_elapsed := greatest(0, extract(epoch from v_now - v_session.last_ping_at));
  if v_delta < -0.1 or v_delta > v_elapsed + 0.75 then raise exception 'Ascolto discontinuo. Riavvia il brano.'; end if;
  -- I heartbeat ogni ~3 s danno credito solo all'avanzamento e al tempo server,
  -- mai a una singola dichiarazione di completamento. Il tetto blocca lunghe assenze.
  v_credit := least(
    v_session.credited_seconds + least(greatest(v_delta, 0), v_elapsed + 0.1, 8.0),
    greatest(0, extract(epoch from v_now - v_session.started_at)) + 0.25
  );
  update vp_private.listening_sessions set credited_seconds = v_credit,
    last_position = p_position, last_ping_at = v_now where id = p_session;
  if p_finish then
    if p_position < v_duration - 0.25 or v_credit < v_duration - 0.5 then raise exception 'Ascolta il brano fino alla fine.'; end if;
    update vp_private.daily_selections set completed_at = coalesce(completed_at, v_now) where id = v_session.selection_id;
    update vp_private.listening_sessions set completed_at = v_now where id = p_session;
  end if;
  return jsonb_build_object('completed', coalesce(p_finish, false), 'creditedSeconds', v_credit);
end;
$$;

insert into supabase_migrations.schema_migrations(version, name) values ('20261005000400', 'bound_session_credit');
commit;

