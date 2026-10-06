# Pannello admin Next Wave

Il pulsante **Pannello admin** compare solo agli utenti che il database riconosce come autorizzati. L’accesso è disponibile negli account Supabase, non nella demo locale. Il browser non decide i permessi: le operazioni vengono verificate dal database e l’ascolto privato passa dal server autenticato.

## Superadmin

L’account con email confermata `santonithomas9@gmail.com` è il superadmin. Non viene creato un account né impostata una password: accede con le sue credenziali normali. La verifica usa `auth.users`, senza fidarsi dei metadati modificabili dall’utente o dell’email inviata dal browser.

Solo il superadmin può aggiungere e revocare altri admin. Il suo accesso non può essere revocato dal pannello; un trigger sul database blocca anche la cancellazione dell’account e il cambio della sua email. Restano possibili password recovery e aggiornamento della password. Chi amministra direttamente l’infrastruttura può modificare lo schema e rimuovere queste protezioni: non costituiscono un blocco contro il proprietario del database.

Per autorizzare un admin, inserire l’email di un account già registrato e confermato. Gli admin aggiuntivi possono gestire le candidature ma non gli accessi. La revoca viene verificata alla successiva operazione; il pulsante e il pannello vengono aggiornati entro 30 secondi o al ritorno sulla finestra. Un URL audio già firmato resta valido per i suoi 10 minuti.

## Candidature

Il pannello mostra candidature in attesa, approvate e rifiutate. È possibile confrontare il link Spotify con l’ascolto privato, verificare requisiti e diritti, e assegnare un giorno futuro entro 30 giorni. Per approvare sono necessarie tutte le conferme della checklist, anche sul database. Il rifiuto richiede una motivazione. Prima della decisione viene mostrata una conferma.

Sono conservati revisore, data e nota della decisione. L’approvazione richiama la logica del contest esistente: il brano è selezionabile nella data assegnata, senza garantire esposizioni. Audio incompleti o con termine di revisione scaduto non possono essere approvati da questo pannello. Nessun file viene eliminato.

## Attivazione su un progetto esistente

1. Applicare `supabase/updates/admin-console.sql` una volta nel SQL Editor, dopo la migrazione audio. In alternativa usare la nuova migrazione tramite il normale flusso CLI.
2. Pubblicare frontend e aggiornamento di `api/audio.ts` insieme. Conservare le variabili server audio già configurate; non sono richiesti nuovi segreti.
3. Accedere con l’email confermata del superadmin e verificare il pulsante. Provare un account ordinario: il pulsante deve essere assente e `#admin` deve riportare alla pagina giornaliera.
4. Provare autorizzazione e revoca di un secondo account, poi una candidatura reale e il suo ingresso nel contest assegnato.

Verifiche locali: `npm run admin:test`, `npm run db:test`, `npm test`, `npm run build`.
