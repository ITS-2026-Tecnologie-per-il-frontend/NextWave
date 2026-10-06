# PKCE con spot-auth

Il progetto usa `spot-auth` 0.1.0, `SpotAuthProvider` e `SpotAuthBarrier` da `spot-auth/react`. La barriera viene montata solo dopo il clic su Collega Spotify: non blocca l'accesso alle altre funzioni Next Wave e non forza il login Spotify entrando nel profilo.

## Flusso

1. Next Wave verifica la sessione Supabase e ottiene la configurazione pubblica dal server.
2. Il provider genera verifier, challenge SHA-256 e state. Prima di navigare, il server associa lo state all'utente Supabase in una registrazione monouso e imposta un cookie cifrato HttpOnly.
3. Spotify torna su `/auth/spotify/callback`. Next Wave verifica state e account Supabase e rimuove il codice dalla cronologia.
4. Il server verifica utente, origine, cookie, scadenza e state monouso. Scambia il codice con verifier e Client ID, senza Client Secret per il nuovo flusso PKCE.
5. Il server legge il profilo Spotify e conserva i token cifrati su Supabase. Nessun token Spotify viene restituito al browser. Il browser elimina verifier e state e torna al profilo.
6. Il rinnovo dei collegamenti PKCE usa Client ID e refresh token sul server; i collegamenti precedenti mantengono il loro metodo di rinnovo.

La callback React è specifica di Next Wave. Non usiamo `SpotAuthCallback` della libreria perché conserva i token in localStorage: manteniamo invece il deposito cifrato server già presente. Non servono nuove tabelle o migrazioni per questa modifica.

## Adattamento della libreria

La versione 0.1.0 usa Math.random per state e può avviare due redirect con StrictMode. `scripts/patch-spot-auth.mjs`, eseguito dopo npm ci/install e prima della compilazione, applica una modifica controllata: state crittografico, hook beforeAuthorize per registrare il tentativo sul server, provider inizialmente privo di token del browser e barriera con un solo tentativo e gestione errori.

Lo script verifica la versione e il sorgente e si interrompe se la libreria cambia. Non modificare manualmente node_modules. Prima di aggiornare spot-auth occorre rivedere l'adattamento. I componenti adattati non sono un'API ufficiale della libreria.

## Configurazione Spotify e Vercel

Aggiungere nella dashboard Spotify, tra i Redirect URIs, esattamente:

`https://next-wave-iota.vercel.app/auth/spotify/callback`

Il vecchio `/api/spotify/callback` può rimanere registrato per compatibilità. Le variabili server Vercel già presenti restano valide; SPOTIFY_REDIRECT_URI può mantenere il vecchio valore sullo stesso dominio. Il nuovo flusso deriva il percorso sopra da quel dominio. Non inserire Client Secret nel frontend o aggiungere variabili VITE con chiavi riservate.

Vercel ha una riscrittura specifica che serve React sulla nuova callback. Dopo il deploy, provare collegamento, rifiuto del consenso, scollegamento e ritorno con un account Next Wave diverso. Il test live richiede il deploy e la registrazione del nuovo redirect.

Il cambio di libreria non modifica il limite Spotify Development Mode: gli account devono ancora essere autorizzati. Per l'accesso pubblico serve l'abilitazione Spotify appropriata.

Riferimenti:

- https://www.npmjs.com/package/spot-auth
- https://github.com/Be-Casual-Studios/spot-auth
- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
