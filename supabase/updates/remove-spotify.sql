-- Aggiornamento del progetto esistente: eseguire UNA VOLTA.
begin;
-- Rimuove soltanto credenziali e tentativi OAuth; conserva utenti, brani e link.
-- La precedente migrazione rimane nello storico dei database già aggiornati.
drop function if exists public.spotify_server(text,uuid,jsonb);
drop table if exists vp_private.spotify_states;
drop table if exists vp_private.spotify_connections;

insert into supabase_migrations.schema_migrations(version,name) values ('20261006000200','remove_spotify_auth');
commit;

