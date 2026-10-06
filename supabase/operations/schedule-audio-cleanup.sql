-- Eseguire dopo la migrazione audio e il deployment Vercel.
-- Abilitare prima pg_cron (Cron) e pg_net nelle estensioni Supabase.
-- Creare in Supabase Vault un segreto chiamato nextwave_audio_cleanup_secret,
-- con LO STESSO valore di AUDIO_CLEANUP_SECRET su Vercel. Non inserire chiavi nel repository.
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='nextwave_audio_cleanup_secret') then
    raise exception 'Crea prima il segreto nextwave_audio_cleanup_secret in Vault.';
  end if;
end $$;

-- Ripetibile: aggiorna il job omonimo, senza crearne duplicati.
select cron.schedule('nextwave-audio-cleanup','*/15 * * * *', $job$
  select net.http_post(
    url := 'https://next-wave-iota.vercel.app/api/audio',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='nextwave_audio_cleanup_secret')),
    body := '{"action":"cleanup"}'::jsonb,
    timeout_milliseconds := 55000
  );
$job$);

-- Lo Storage viene eliminato attraverso la sua API dal server Vercel.
-- Non fare DELETE FROM storage.objects: non elimina il file fisico.
