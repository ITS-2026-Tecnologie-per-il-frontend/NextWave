# Next Wave: decisioni approvate

Next Wave prosegue senza collegamento agli account o API Spotify. Gli utenti e le preferenze musicali restano gestiti da Supabase. Il contest conserva ascolti completi in ordine, voto unico e rivelazione alle 21:00.

Il caricamento diretto dei brani sarà la fonte principale del catalogo. Questa pulizia rimuove l'integrazione precedente; il caricamento audio non è ancora implementato.

## Prossima fase

- Modificare il modulo artista: nome, titolo, genere, lingua, audio e conferma dei diritti. Il link Spotify sarà facoltativo; eliminare la dipendenza dall'obbligo di pubblicazione su Spotify e rivedere il criterio degli ascoltatori mensili.
- Implementare caricamento su Cloudflare R2 privato, con Supabase per utenti e metadati e Vercel per l'app. Aggiungere controlli sui formati e limiti di dimensione; i valori numerici vanno definiti prima dell'implementazione. Questa integrazione non è ancora presente.
- Raccogliere le autorizzazioni necessarie per l'ascolto dei brani e verificarle prima dell'approvazione.
- Approvare le candidature prima di inserirle nel contest; proteggere la riproduzione dei file e nascondere i metadati prima della rivelazione.
- Mostrare “Apri su Spotify” dopo la rivelazione soltanto se esiste un link al brano. È un link esterno: non collega account e non salva automaticamente nella libreria Spotify.

## Pulizia del progetto già pubblicato

Eseguire una volta `supabase/updates/remove-spotify.sql` nel SQL Editor del progetto esistente. Elimina soltanto la funzione OAuth, i token cifrati e i tentativi di collegamento; non rimuove gli account Next Wave, le candidature, il catalogo o i voti. Non rieseguire setup.sql o setup-demo.sql sul database esistente.

Su Vercel rimuovere le variabili SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI e SPOTIFY_TOKEN_ENCRYPTION_KEY. In questa versione anche SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL erano usate solo dall'integrazione eliminata: possono essere rimosse. Conservare VITE_DATA_MODE, VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.

Pubblicare la pulizia con un nuovo deploy. Chi aveva collegato Spotify può revocare Next Wave anche nella pagina delle app autorizzate del proprio account Spotify. Le vecchie migrazioni restano come storico; l'ultima migrazione rimuove l'integrazione anche da una nuova installazione.
