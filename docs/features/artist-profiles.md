# Profili artista e candidature mensili

Nel profilo l’utente può scegliere Ascoltatore o Artista. I nuovi account sono ascoltatori; chi aveva già candidature mantiene la sezione artista. Il cambio non modifica ascolti, voti, candidature o permessi admin.

Solo il profilo artista mostra la voce Per gli artisti. Gli URL diretti degli ascoltatori riportano al profilo; il database impedisce anche l’invio diretto delle candidature senza profilo artista.

La pagina mette lo storico prima del caricamento. Il modulo è chiuso inizialmente e si apre con Candida la traccia del mese. Mostra stato, data e ora italiana dell’invio e giorno del contest per ogni candidatura.

È ammessa una traccia inviata con audio valido per account in ciascun mese solare, nel fuso Europe/Rome. Anche il rifiuto conta nella quota; i tentativi falliti o annullati non la consumano. Il mese è determinato al completamento della verifica audio. Cambiare profilo non azzera il limite. I caricamenti simultanei e la conferma audio vengono controllati dal database. Dal mese successivo gli audio conservati delle candidature precedenti non bloccano una nuova candidatura; resta il limite complessivo dello Storage già esistente.

`submitted_at` registra il completamento dell’invio valido. Per lo storico con audio verificato viene inizializzato con la precedente data di creazione, senza inventare l’ora di completamento. La data e ora visibile nella scheda rimane quella originale di creazione della candidatura.

Per attivare: applicare `supabase/updates/artist-profiles.sql` dopo `admin-console.sql` e pubblicare il frontend aggiornato. Nessuna cancellazione di dati.

Verifiche: `npm run artist:test`, `npm run db:test`, `npm run admin:test`, `npm run check`, `npm run build`.
