-- Solo se il precedente job era già stato pianificato nel progetto remoto.
-- Non disabilita estensioni, non elimina segreti, file o dati del contest.
do $$
declare v_job bigint;
begin
  if to_regclass('cron.job') is not null then
    for v_job in select jobid from cron.job where jobname='nextwave-audio-cleanup' loop
      perform cron.unschedule(v_job);
    end loop;
  end if;
end;
$$;
