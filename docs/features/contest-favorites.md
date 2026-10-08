# Navigazione e scoperte salvate

La barra laterale usa il riquadro account come unico collegamento al profilo; su mobile il profilo resta raggiungibile dall'avatar dell'intestazione. Il richiamo duplicato alla candidatura è stato rimosso.

Il contest permette di salvare ogni brano dopo averne completato l'ascolto. Il salvataggio è indipendente dal voto e può essere annullato. Dopo il reveal è disponibile anche senza completamento, come prima. Il contatore delle scoperte e la lista del profilo si aggiornano insieme. Prima del reveal, titolo, artista e link restano nascosti anche nella risposta del database relativa ai preferiti.

I pulsanti esterni sono condivisi tra contest, classifiche, reveal e profilo. I collegamenti Spotify usano l'icona SVG ufficiale verde su nero e la dicitura “Apri Spotify”. Gli altri siti usano un'icona generica. Fonte e condizioni del marchio: [Spotify](https://developer.spotify.com/documentation/design).

## Attivazione

Applicare una volta [contest-favorites.sql](../../supabase/updates/contest-favorites.sql) nel SQL Editor, dopo [multiple-superadmins.sql](../../supabase/updates/multiple-superadmins.sql), oppure usare la migrazione `20261008000500_contest_favorites.sql` tramite il flusso Supabase abituale. Farlo prima di pubblicare il frontend: la vecchia RPC consente il salvataggio soltanto dopo il reveal. Lo script mantiene selezioni, voti e preferiti esistenti. Non viene applicato al database online dai test locali.

Verifiche: `npm run favorites:test`, `npm test`, `npm run build`.

## Player musicale

Su desktop titolo e genere stanno a sinistra, rewind, play e preferiti sono centrati sopra l’avanzamento, e il volume sta a destra. Su mobile titolo e volume occupano la prima riga, i tre comandi sono centrati nella seconda. Il pulsante preferiti condivide lo stato delle schede del contest e segue gli stessi requisiti di ascolto/reveal.

Il volume iniziale è al 100%. Il clic sull’icona silenzia il media element e porta il cursore a zero; un secondo clic ripristina l’ultimo volume non nullo. Il volume del dispositivo resta sotto il controllo dell’utente.
