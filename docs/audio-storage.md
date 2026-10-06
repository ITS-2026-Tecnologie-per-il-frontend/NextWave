# Audio su Supabase

L’artista candida un brano già pubblicato: inserisce il link Spotify e carica il proprio MP3. NextWave usa il file nel contest e mostra il link alla rivelazione. Non usa API Spotify né account Spotify collegati.

La cancellazione automatica è sospesa su richiesta del gruppo. Gli audio restano nello Storage privato dopo il contest; non vengono cancellati file o dati dell’app in automatico.

## Configurazione

1. Eseguire una volta `supabase/updates/temporary-audio.sql` soltanto se non è già stato applicato. Questa migrazione è lo storico dello schema: non rieseguirla sul progetto corrente.
2. Su Vercel conservare `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e la variabile server `SUPABASE_SERVICE_ROLE_KEY`. Non usare il prefisso VITE_ per la chiave amministrativa.
3. Pubblicare il codice aggiornato. `/api/audio` gestisce soltanto preparazione, verifica, annullamento del caricamento e ascolto. La vecchia azione `cleanup` viene rifiutata.

Per upload e ascolti privati usare il deployment Vercel oppure Vercel CLI con le variabili server. `npm start` avvia solo Vite, sufficiente per la demo locale.

Il bucket `nextwave-audio` resta privato. Il server firma il caricamento prenotato e l’audio dello slot autorizzato dal database. Non aggiungere policy di lettura o scrittura generali al bucket.

## Rimozione della precedente configurazione automatica

`AUDIO_CLEANUP_SECRET` non è più richiesto dal codice ed è stato rimosso dal modello e dalla configurazione locale. La variabile omonima su Vercel e il segreto `nextwave_audio_cleanup_secret` in Supabase Vault possono essere rimossi dai rispettivi pannelli. Conservare `SUPABASE_SERVICE_ROLE_KEY`, che serve ancora agli audio privati.

Nei passaggi svolti finora sono state abilitate le estensioni, ma non è stato eseguito lo script di pianificazione. Se il job `nextwave-audio-cleanup` fosse stato creato da un collaboratore, eseguire `supabase/operations/disable-audio-cleanup.sql` per rimuovere soltanto quel job. Non occorre disabilitare pg_cron o pg_net: le estensioni da sole non eseguono cancellazioni.

Le migrazioni già applicate conservano tabelle e operazioni amministrative storiche per non riscrivere lo schema remoto. I test SQL ne verificano ancora i permessi e la conservazione dei dati; nessuna operazione di pulizia è richiamata dall’app o pianificata dal repository.

## Cinque campioni demo

I cinque WAV sintetici sono stati caricati e verificati in `demo/0.wav` … `demo/4.wav`, con circa 2,65 MB complessivi. Le copie locali restano disponibili per la demo senza account.

Per ripetere il trasferimento, configurare la chiave amministrativa in `.env.audio.local`, escluso da Git, e mantenere l’URL in `.env.local`:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=incolla_la_chiave_amministrativa_solo_qui
```

```sh
npm run audio:upload-demo
```

Il comando aggiorna il catalogo cloud solo quando tutti i cinque file sono presenti e verificati. I campioni e gli artisti sono inventati: il link richiesto per questi brani è marcato “Link Spotify di esempio”. Le candidature reali hanno invece il proprio link.

## Limiti e moderazione

- MP3 fino a 10.000.000 byte, durata da 1 secondo a 30 minuti. Il server controlla il formato e rimuove i tag ID3/APE. La verifica dei metadati non può nascondere un’identità riconoscibile nell’audio stesso.
- Una candidatura audio attiva per account e massimo 40 prenotazioni. Ogni prenotazione riserva 10 MB, con spazio per una copia originale e una preparata: fino a 800 MB, oltre ai campioni e agli altri dati dello Storage.
- I termini già presenti nello schema rimangono: caricamento entro 3 ore, revisione della candidatura pronta entro 7 giorni. Queste scadenze limitano le operazioni; non eliminano più i file.
- Senza pulizia automatica lo spazio e le prenotazioni non si liberano da soli. Anche gli originali privati restano conservati. La gestione e la liberazione dello spazio vanno affrontate manualmente prima di aumentare il catalogo.
- I moderatori verificano diritti, audio, corrispondenza del link e ascoltatori mensili autodichiarati. Una candidatura non entra automaticamente nel contest.

```sh
npm run audio:admin -- list
npm run audio:admin -- preview ID_CANDIDATURA
npm run audio:admin -- approve ID_CANDIDATURA YYYY-MM-DD
npm run audio:admin -- reject ID_CANDIDATURA
```

Il link di revisione dura 10 minuti e non va condiviso. L’approvazione assegna un giorno fra domani e i prossimi 30 giorni; il brano entra nelle selezioni soltanto quel giorno. Dopo le 21:00 Europe/Rome l’app mostra il link Spotify e mantiene il file nello Storage.

Il catalogo demo è ancora attivo e può produrre selezioni miste. Prima di un contest reale, i moderatori possono disattivarlo con `update vp_private.tracks set active=false where is_demo;` nel SQL Editor, conservando file e storico.
