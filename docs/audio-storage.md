# Audio temporanei su Supabase

L’artista candida un brano già pubblicato: inserisce il link Spotify e carica il proprio MP3. NextWave usa il file nel contest e mostra il link alla rivelazione. Non usa API Spotify né account Spotify collegati.

## Attivazione sul progetto esistente

1. Eseguire **una volta** `supabase/updates/temporary-audio.sql` nel SQL Editor, dopo la precedente rimozione delle API Spotify. Non rieseguire i setup iniziali.
2. In Vercel, conservare `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Aggiungere `SUPABASE_SERVICE_ROLE_KEY` e `AUDIO_CLEANUP_SECRET` per Production. La prima è la chiave amministrativa Supabase; la seconda è una stringa casuale di almeno 32 byte, ad esempio generata con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Queste due variabili sono soltanto server: **mai usare il prefisso VITE_** e mai committare i valori.
3. Pubblicare i file aggiornati su Vercel. `/api/audio` è una funzione Node, con durata massima di 60 secondi. `npm start` avvia soltanto Vite: la demo locale funziona, ma per provare upload e audio privati usare il deployment Vercel oppure Vercel CLI con le variabili server locali.
4. In Supabase abilitare **Cron / pg_cron** e **pg_net**. In Vault creare il segreto `nextwave_audio_cleanup_secret`, uguale a `AUDIO_CLEANUP_SECRET` su Vercel. Eseguire `supabase/operations/schedule-audio-cleanup.sql`. Verificare che il dominio indicato nel file sia quello di produzione; se il dominio cambia, aggiornare e rieseguire il job.
5. Configurare la chiave locale e trasferire i campioni come descritto sotto.

Il bucket `nextwave-audio` viene creato privato dalla migrazione. Non renderlo pubblico e non aggiungere policy che permettano a tutti gli utenti di leggere o scrivere nel bucket. Il server firma solo il caricamento prenotato e l’audio dello slot autorizzato dal database.

## Cinque campioni demo

Creare nella radice **`.env.audio.local`**, ignorato da Git, con:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=incolla_la_chiave_amministrativa_solo_qui
```

L’URL Supabase viene letto dalla `.env.local` già presente. Non condividere la chiave in chat o negli screenshot.

Il file locale predisposto contiene già un valore casuale per `AUDIO_CLEANUP_SECRET`: copiare lo stesso valore su Vercel e nel segreto Vault, conservando entrambe le righe del file. Non è una chiave Spotify.

```sh
npm run audio:upload-demo
```

Il comando carica tutti e cinque i WAV in `demo/0.wav` … `demo/4.wav`, poi aggiorna il catalogo cloud. Se un caricamento fallisce, non cambia i percorsi del catalogo: si può ripetere il comando. Conserva i WAV locali per la demo. Non richiede di inserire file nel database: il database contiene solo i riferimenti.

Tutti i campioni sono sintetici e gli artisti inventati. Per questi soli brani, il link richiesto dall’utente è marcato **“Link Spotify di esempio”**. Non indica la vera origine del campione. Le candidature reali conservano invece il proprio link. I cinque oggetti demo vengono riutilizzati quotidianamente e sono esclusi dalla cancellazione dei brani reali: occupano complessivamente circa 2,65 MB.

## Limiti e verifica delle candidature

- MP3 di massimo **10.000.000 byte** e durata da 1 secondo a 30 minuti. Un WAV rinominato `.mp3` viene rifiutato. La conferma nel browser non sostituisce il controllo del server.
- Una candidatura audio attiva per account. La prenotazione del caricamento scade entro 3 ore; un MP3 pronto ma non esaminato scade dopo 7 giorni.
- Massimo 40 prenotazioni, riservando 10 MB ciascuna: 400 MB per i file preparati e fino ad altri 400 MB per gli originali temporanei. Il margine lascia spazio ai campioni e al funzionamento sul piano da 1 GB. Il limite riguarda questo flusso; file caricati manualmente o altri bucket consumano lo spazio totale del progetto.
- I file originali rimangono privati fino alla scadenza delle firme di upload, poi il cron li elimina. Il file ascoltabile ha nome casuale e tag ID3/APE rimossi; il sistema non può impedire che il testo o l’audio stesso identifichino l’artista.
- I moderatori controllano diritti, audio completo, corrispondenza del link e criterio dei meno di 10.000 ascoltatori mensili, che rimane autodichiarato. Una candidatura non entra automaticamente nel contest.

Revisione amministrativa sul proprio computer, usando la chiave locale:

```sh
npm run audio:admin -- list
npm run audio:admin -- preview ID_CANDIDATURA
npm run audio:admin -- approve ID_CANDIDATURA YYYY-MM-DD
npm run audio:admin -- reject ID_CANDIDATURA
```

`preview` restituisce un link privato valido 10 minuti: non condividerlo. `approve` assegna un giorno tra domani e i prossimi 30 giorni; il file serve solo al contest di quel giorno. Servono almeno cinque brani disponibili nei generi scelti dall’ascoltatore. Il catalogo demo attualmente permette anche selezioni miste: prima di un contest reale, disattivare i candidati demo dal catalogo con `update vp_private.tracks set active=false where is_demo;` nel SQL Editor. Questo non elimina lo storico né i file demo.

## Dopo il contest

Alle 21:00 Europe/Rome termina l’ascolto in app e vengono mostrati nomi e link. Il job ogni 15 minuti disattiva gli audio scaduti, li elimina attraverso **Storage API**, poi azzera il riferimento al file e registra la data di cancellazione. Non elimina righe di candidature, artisti, brani, selezioni, voti, preferiti o risultati. Il link Spotify resta disponibile dopo la rivelazione e nei salvati.

Se Storage restituisce un errore, il database non dichiara il file cancellato: l’operazione resta da riprovare al giro successivo. Anche gli upload incompleti, i brani rifiutati e le candidature non esaminate vengono ripuliti. Le prenotazioni vengono liberate solo quando anche l’originale è stato rimosso.

Il cron richiede che Supabase e Vercel siano operativi. Controllare l’esecuzione in Supabase Cron, le risposte HTTP in `net._http_response` e gli errori della funzione nei log Vercel. Un HTTP 503 indica una pulizia parzialmente fallita o un servizio non configurato; un 401 indica un segreto non corrispondente. Non esporre il segreto nei log. Il dominio della funzione deve essere accessibile al job senza protezione aggiuntiva del deployment.

Per rieseguire subito la pulizia, senza stampare la chiave, da PowerShell con `AUDIO_CLEANUP_SECRET` già caricato nell’ambiente:

```powershell
Invoke-RestMethod -Method Post -Uri 'https://next-wave-iota.vercel.app/api/audio' -Headers @{ Authorization = "Bearer $env:AUDIO_CLEANUP_SECRET" } -ContentType 'application/json' -Body '{"action":"cleanup"}'
```

Il limite di spazio non limita il traffico degli ascolti: controllare anche le quote di trasferimento del piano Supabase.

## Riferimenti

La cancellazione avviene tramite API perché una cancellazione SQL di `storage.objects` non rimuove il file fisico: [Supabase: Delete objects](https://supabase.com/docs/guides/storage/management/delete-objects). La pianificazione usa Cron, pg_net e un segreto Vault: [Supabase: Schedule functions](https://supabase.com/docs/guides/functions/schedule-functions). Il browser carica direttamente su Storage per rispettare i limiti del corpo delle richieste delle [funzioni Vercel](https://vercel.com/docs/functions/limitations).
