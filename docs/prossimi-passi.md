# NextWave: decisioni approvate

Gli artisti candidano un brano pubblicato inserendo il link Spotify e caricando un MP3 su Supabase Storage privato. NextWave riproduce questo file nel contest anonimo, senza API Spotify. Dopo la rivelazione mostra il link ufficiale; gli audio, i metadati e i risultati rimangono conservati.

Il modulo, la verifica server, i percorsi privati sono implementati nel repository. Per attivarli sul progetto pubblicato, applicare la nuova migrazione, configurare le variabili server, poi trasferire i cinque campioni. I passaggi sono in [audio-storage.md](audio-storage.md). Nessun trasferimento remoto è implicito nella build.

I campioni sintetici usano un link Spotify di esempio; le candidature reali hanno il proprio link. Diritti, corrispondenza del brano e ammissione vengono verificati manualmente, assegnando un contest futuro.

La precedente integrazione Spotify resta sospesa: nessun OAuth, token, libreria Spotify o import automatico dei gusti. Le vecchie migrazioni sono lo storico del database. Se non già eseguito, applicare prima `supabase/updates/remove-spotify.sql`. Rimuovere le variabili SPOTIFY_* da Vercel; `SUPABASE_SERVICE_ROLE_KEY` serve ora al server per gestire lo Storage privato.
