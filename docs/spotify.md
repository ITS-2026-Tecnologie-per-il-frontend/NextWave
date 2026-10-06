# Collegamento Spotify

Aggiornamento: il pulsante Collega Spotify ora usa i componenti `spot-auth` con PKCE e una nuova callback React. Per attivarlo aggiungere il nuovo redirect indicato in [spot-auth.md](spot-auth.md). Le funzioni precedenti restano per compatibilità; la conservazione dei token continua sul server.

Endpoint e schemi verificati sulla specifica ufficiale https://developer.spotify.com/reference/web-api/open-api-schema.yaml. Le richieste gestiscono 401, 403 e 429; per 429 si rispettano Retry-After e attese esponenziali con un massimo di tre tentativi. Se l'attesa supera il budget della funzione, viene restituito un errore con Retry-After senza riprovare subito. Un refresh token scaduto o revocato elimina il collegamento e richiede una nuova autorizzazione. Non vengono conservati cataloghi o contenuti Spotify per analisi o addestramento; restano solo i dati necessari al collegamento dell'account, eliminati quando viene scollegato.

Il profilo Next Wave consente di collegare e scollegare Spotify. L'accesso a Next Wave resta quello Supabase. Il server verifica l'utente, usa state monouso e PKCE, scambia il codice Spotify e conserva i token cifrati AES-256-GCM in uno schema privato. Il browser non riceve i token Spotify. Lo stato del collegamento rinnova i token prossimi alla scadenza. Scollegare elimina credenziali e autorizzazioni pendenti dal database; per revocare anche il consenso Spotify usare la pagina App del proprio account Spotify.

## Attivazione sul progetto esistente

1. Eseguire una volta `supabase/update-spotify.sql` nel SQL Editor. Non rieseguire setup.sql o setup-demo.sql.
2. Su Vercel, Settings → Environment Variables, aggiungere alle tre variabili Spotify già configurate:
   - `SUPABASE_URL`: https://xitmtulynclfozfsbhfz.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY`: chiave service_role di Supabase, da Settings → API Keys (legacy). Copiarla direttamente in Vercel, mai nella chat o nel codice frontend.
   - `SPOTIFY_TOKEN_ENCRYPTION_KEY`: una chiave casuale di 32 byte in base64, generata sul proprio computer con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Conservarla: cambiarla rende illeggibili i collegamenti esistenti.
3. Commit e push delle modifiche, quindi deploy Vercel. Le nuove variabili richiedono un nuovo deploy.
4. Accedere a Next Wave, aprire Profilo → Collega Spotify, autorizzare e verificare il nome del profilo. Provare anche Scollega Spotify e il rifiuto dell'autorizzazione.

Il redirect registrato su Spotify deve essere esattamente `https://next-wave-iota.vercel.app/api/spotify/callback`. I domini preview non sono configurati per il collegamento. Il normale server Vite non esegue le funzioni Vercel: il flusso completo va provato sul dominio configurato.

## Funzionalità e limiti

Questa prima integrazione legge il profilo Spotify con il permesso user-read-private. Non importa automaticamente generi, libreria o artisti preferiti. Ulteriori endpoint e permessi vanno aggiunti quando viene definita la funzione relativa, nel rispetto delle regole Spotify. Il contest continua a usare audio autorizzato dagli artisti; collegare Spotify non abilita lo streaming dei brani del catalogo Spotify nel contest.

In Development Mode valgono i limiti e la lista di utenti autorizzati del pannello Spotify. Non considerare il collegamento disponibile a tutti i visitatori finché non è stata ottenuta l'abilitazione appropriata.

Riferimenti: https://developer.spotify.com/documentation/web-api/tutorials/code-flow e https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow.
