# Preferenze aggiornate nel contest corrente

Prima delle 21 e del voto, salvare generi diversi rigenera gli slot non ancora iniziati, bilanciando i generi disponibili nei cinque posti giornalieri. Esempio: con un solo brano Indie, aggiungere Hip hop rende disponibile anche il candidato Hip hop del contest corrente. Sono ammessi soltanto brani approvati, idonei e assegnati al giorno corretto; restano esclusi sottogeneri, demo, audio eliminati e candidati oltre la coda dei primi cinque per genere.

Ascolti iniziati e completati mantengono ID, posizione, progresso e preferiti. Riordinare gli stessi gusti, aggiornare il nome o ricaricare una selezione piena non sorteggia nuovamente i brani. Dopo il voto o il reveal valgono i gusti nuovi nei giorni successivi. Un aggiornamento dei dati può completare gli slot vuoti con nuovi candidati disponibili, senza sostituire quelli presenti; una selezione votata resta invariata.

## Attivazione

Applicare una volta [live-genre-preferences.sql](../../supabase/updates/live-genre-preferences.sql) dopo `contest-favorites.sql`, oppure applicare la migrazione `20261009000100_live_genre_preferences.sql` tramite Supabase CLI. La migrazione non cancella selezioni esistenti all’installazione: la sostituzione interessa solo gli slot non iniziati durante il successivo salvataggio di gusti diversi. Il database online non viene aggiornato dai test locali.

La demo locale aggiorna subito la selezione, mantenendo il brano attivo e gli ascolti completati. I test PostgreSQL usano un database temporaneo e un orologio controllato; nessun account o candidatura online viene modificato.

Verifiche: `npm run preferences:test`, `npm run balance:test`, `npm run selection:test`, `npm run queue:test`, `npm test`, `npm run build`.
