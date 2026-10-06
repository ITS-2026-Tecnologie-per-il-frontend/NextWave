-- Rimuove soltanto credenziali e tentativi OAuth; conserva utenti, brani e link.
-- La precedente migrazione rimane nello storico dei database già aggiornati.
drop function if exists public.spotify_server(text,uuid,jsonb);
drop table if exists vp_private.spotify_states;
drop table if exists vp_private.spotify_connections;
