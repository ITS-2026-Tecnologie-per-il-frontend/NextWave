# Coda per genere e preferenze

Ogni genere ha cinque posti per giornata. L’admin approva le candidature e sceglie il primo giorno dal quale il brano può partecipare, da domani a trenta giorni. La coda assegna automaticamente il primo giorno con un posto libero, anche oltre la data scelta. Non serve un’approvazione quotidiana o un’attività programmata: data e disponibilità dell’audio sono salvate subito.

La priorità è l’orario di invio completato (`submitted_at`), con l’orario di creazione come ripiego per lo storico. Le candidature rifiutate e quelle ancora da approvare non occupano posti. Approvare prima una candidatura inviata dopo non le dà priorità: ogni approvazione riordina i giorni futuri dello stesso genere. La giornata già iniziata e le selezioni già assegnate restano ferme. A parità di orario, l’identificativo garantisce un ordine stabile.

Esempio: dodici candidature Trap idonee allo stesso primo giorno diventano cinque nel primo giorno, cinque nel secondo e due nel terzo. L’audio viene conservato fino alle 21:00 italiane del giorno effettivo. Il pannello mostra calendario, posti occupati e candidature spostate in lista di attesa. Anche gli artisti vedono la data aggiornata nel proprio storico.

Ogni ascoltatore sceglie da uno a cinque generi. Con un solo genere, ascolta i brani disponibili in ordine di invio. Con più generi, riceve un sorteggio personale di cinque brani fra quelli dei generi scelti. Il sorteggio resta identico per tutta la giornata; non garantisce che ogni genere sia rappresentato o che due utenti non ricevano mai la stessa combinazione. Con meno di cinque brani compatibili, compaiono soltanto quelli reali disponibili, come nella correzione precedente. Non vengono aggiunti generi estranei o brani fittizi.

Il limite è verificato nell’interfaccia e nel database. Gli account preesistenti con più di cinque preferenze vengono invitati a scegliere quali mantenere prima di continuare: nessuna preferenza viene cancellata automaticamente. Prima del voto e del reveal, cambiare gusti aggiorna gli slot non ancora iniziati; gli ascolti avviati o completati restano nella selezione. Gli slot parziali possono riempirsi quando diventano disponibili nuovi candidati.

Applicare `supabase/updates/genre-queue.sql` dopo `partial-daily-selection.sql`, poi pubblicare l’interfaccia aggiornata. La migrazione riordina anche le programmazioni future esistenti; conserva contest già iniziati, candidature e voti. Tutte le approvazioni passano dalla stessa coda anche quando arrivano da più admin contemporaneamente, grazie a un blocco della coda per genere prima dei blocchi delle candidature.

Verifiche: `npm run queue:test` prova dodici approvazioni inverse, calendario 5/5/2, conservazione audio, rifiuti, limite dei generi, filtro dei gusti, sorteggio e stabilità del contest iniziato. `npm run selection:test` copre il catalogo piccolo e la chiusura alle 21. `npm run check` verifica anche il limite nell’interfaccia.
