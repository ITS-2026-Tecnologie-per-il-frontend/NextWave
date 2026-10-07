# Selezioni con meno di cinque brani

Il sistema precedente richiedeva almeno cinque brani approvati per il giorno e compatibili con i gusti dell’utente. Con soltanto due candidature approvate la selezione non veniva creata; anche l’interfaccia e il voto richiedevano cinque ascolti.

Ora una selezione può contenere da uno a cinque brani reali. L’interfaccia mostra i brani disponibili e lascia i restanti spazi come segnaposto, senza artisti, titoli, audio o metriche inventati. Il voto è consentito dopo aver completato tutti i brani effettivamente assegnati. Il numero richiesto è controllato dal database, il voto resta unico e si chiude alle 21:00 Europe/Rome.

Rimangono necessari approvazione, data corretta, audio disponibile e corrispondenza con i generi preferiti. Due brani Hip hop e Reggaeton sono entrambi mostrati agli account che hanno scelto entrambi i generi. La selezione rimane stabile dopo la creazione; non vengono assegnati nuovi brani dopo la chiusura del contest.

Per attivare: applicare `supabase/updates/partial-daily-selection.sql` dopo `real-contests.sql`, pubblicare l’interfaccia aggiornata e ricaricare la pagina prima delle 21:00. Nessuna candidatura o voto viene cancellato o modificato.

Verifiche: `npm run selection:test` riproduce il caso del 07/10/2026 con due brani e prova ascolti, voto, gusti, data e chiusura. `npm run check` verifica anche la visualizzazione e i tre spazi vuoti.
