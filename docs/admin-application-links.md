# Link dei brani nelle candidature admin

Gli account admin verificati, compreso il superadmin, possono candidare un brano con un link HTTP o HTTPS di qualsiasi piattaforma: Suno, YouTube, SoundCloud o un sito proprio. Gli utenti ordinari conservano il requisito del link Spotify a un brano. Restano richiesti MP3, diritti e tutti gli altri campi della candidatura.

Il ruolo viene verificato nel database tramite `vp_private.is_admin`, indipendentemente dai dati inviati dal browser. La revoca dei permessi admin ripristina immediatamente il requisito Spotify per le nuove candidature. I link vengono conservati nella candidatura e nel brano approvato e restituiti in revisione, profilo, reveal, preferiti e classifiche. I link esterni vengono mostrati come “Apri il brano”, senza indicarli come Spotify.

## Attivazione sul database esistente

Applicare una volta `supabase/updates/admin-application-links.sql`, dopo `balanced-genre-selection.sql`, oppure la migrazione `20261008000200_admin_application_links.sql` tramite il normale flusso CLI. Non rieseguire il setup iniziale. Questa modifica non cancella dati né riscrive le vecchie candidature Spotify.

Il solo aggiornamento del frontend non basta: prima dell’applicazione della migrazione il database richiede ancora l’identificativo Spotify. La migrazione è preparata e collaudata localmente; la generazione dei bundle non modifica il progetto remoto.

## Verifiche

`npm run admin:links:test` esamina superadmin, admin delegato, revoca, tentativi di falsificare il ruolo, link non validi, duplicati pendenti, approvazione e restituzione nel profilo. `npm test` verifica anche la validazione frontend. Sono stati rieseguiti i test della coda, del pannello admin e dei contest reali per controllare che l’eccezione non cambi gli altri comportamenti.

## Campo data della classifica su telefono

Il selettore del giorno ha un contenitore a colonna restringibile e regole specifiche per le dimensioni intrinseche del campo data WebKit. Le prove browser verificano larghezze 320, 360, 390 e 430 px, vista giornaliera e settimanale, selezione e ripristino del giorno. Il calendario nativo rimane disponibile.

Nei motori di prova il campo rimane nei bordi; questo non dimostra quale versione degli stili sia presente nella cache di un telefono reale. Dopo la pubblicazione, confrontare la stessa pagina in una scheda privata aiuta a distinguere la cache del sito da un comportamento del browser. Le modifiche locali non sono presenti sul sito online finché non vengono pubblicate.
