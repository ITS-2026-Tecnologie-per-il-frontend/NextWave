# Contest con dati reali

Il sito usa esclusivamente gli account Supabase. La modalità demo non è più accessibile dal sito, anche con `VITE_DATA_MODE=demo`: configurare `supabase`. I moduli demo restano solo per le prove di regressione.

I cinque audio sintetici sono stati spostati da `public/audio` a `tests/fixtures/audio`: non vengono più serviti o inclusi nel sito pubblicato.

Campioni, artisti e risultati demo vengono esclusi nel database da nuove selezioni, dashboard, preferiti, diario, ascolti, reveal e classifiche. Gli oggetti e lo storico rimangono conservati. Una selezione già composta da campioni può lasciare la giornata senza cinque brani visibili; il giorno successivo le selezioni usano solo brani reali approvati per quel contest. Non viene aggiunto un catalogo fittizio quando mancano brani.

Il calendario della classifica consente di scegliere un giorno concluso. Il database rifiuta giorni futuri e quello corrente prima delle 21:00 Europe/Rome. Per la settimanale viene mostrata l’ultima settimana conclusa di domenica entro la data scelta. I giorni senza selezioni reali mostrano un messaggio vuoto; i brani realmente assegnati possono comparire anche con zero voti.

Superadmin e admin autorizzati con email confermata sono esenti dal limite mensile. La verifica avviene nel database sia alla prenotazione sia alla conferma dell’audio. La revoca ripristina immediatamente il limite ordinario, contando anche le tracce già inviate dall’admin. Rimangono necessari il profilo artista e i normali controlli audio, diritti, duplicati e approvazione. Non cambia la capacità complessiva dello Storage né il limite di un caricamento incompleto alla volta.

Attivazione: applicare `supabase/updates/real-contests.sql` dopo `artist-profiles.sql`, poi pubblicare il sito aggiornato. Verifiche: `npm run contests:test`, `npm run artist:test`, `npm run admin:test`, `npm run db:test`, `npm run check` e `npm run build`.
