# Esposizione: la pagina di onboarding

La pagina consigliata è `src/pages/Onboarding.tsx`. È un esempio leggibile di come React usa stato, proprietà e rendering condizionale per guidare un utente. Per l’esposizione conviene partire da qui, poi mostrare il collegamento al database.

## Cosa fa la pagina

Presenta Next Wave, raccoglie il nome e i generi preferiti, poi comunica le scelte al componente che gestisce l’account. L’interfaccia cambia senza caricare una nuova pagina HTML.

Mostra due passaggi, introduzione e scelta dei gusti, sia nella demo sia con Supabase. Il collegamento agli account Spotify è stato rimosso. In modalità Supabase il componente riceve un profilo già associato all’account autenticato.

## Cinque punti da spiegare nel codice

1. **Le proprietà del componente.** `profile` contiene i dati iniziali, `onFinish` è la funzione da chiamare al termine, `cloud` distingue account reale e demo, `busy` impedisce un nuovo invio mentre il salvataggio è in corso.
2. **Lo stato con `useState`.** `step` indica il passaggio corrente, `name` conserva il testo inserito, `preferences` conserva i generi scelti. Cambiare lo stato fa aggiornare automaticamente l’interfaccia.
3. **Il rendering condizionale.** Le condizioni `step === 0` e `step === 1` decidono quale contenuto mostrare. Il pulsante iniziale passa dall'introduzione alla scelta dei generi.
4. **Gli eventi.** `onClick` cambia passaggio; `onChange` aggiorna il nome. `GenrePicker` riceve i generi selezionati e una funzione per modificarli. Il campo nome è controllato perché `value` e `onChange` dipendono dallo stato React.
5. **La conferma.** Il pulsante finale è disabilitato se non è stato scelto alcun genere o se è in corso il salvataggio. Al clic chiama `onFinish` con nome, generi e stato onboarding, usando `trim()` per togliere gli spazi inutili e un nome predefinito se il campo è vuoto.

## Collegamento a Supabase

L’onboarding non contiene chiavi, query SQL o dettagli del database. Chiama `onFinish`: nella modalità cloud `Account` in `src/app/CloudAccount.tsx` passa questa richiesta al repository. `src/services/cloudRepository.ts` chiama la funzione SQL `save_profile`, che usa l’identità autenticata per aggiornare soltanto quel profilo e le sue preferenze.

Questa separazione permette di usare la stessa interfaccia con la demo locale e con Supabase. Il componente mostra e raccoglie i dati; il livello di accesso ai dati li salva; il database valida gli input e controlla i permessi.

## Traccia orale breve

“Questa è la pagina di onboarding di Next Wave. Serve a presentare l’app e raccogliere i gusti musicali dell’utente. Ho usato un componente React con alcuni stati: il passaggio corrente, il nome e i generi selezionati. Quando l’utente interagisce, gli eventi aggiornano questi stati e React ridisegna la parte dell’interfaccia interessata.

Il contenuto cambia in base al valore di step. Il nome è un campo controllato e la scelta dei generi è affidata a un componente riutilizzabile. Il pulsante finale controlla che sia stato selezionato almeno un genere e viene disabilitato durante il salvataggio.

Alla fine la pagina chiama una funzione ricevuta dall’esterno. Nell’app reale questa funzione salva i dati in Supabase, dove ogni utente può gestire soltanto il proprio profilo. Così mantengo separati interfaccia, accesso ai dati e regole del database.”

## Domande probabili

| Domanda                                   | Risposta breve                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Perché React?                             | Permette di dividere l’interfaccia in componenti e aggiornarla quando cambia lo stato.                      |
| Che differenza c’è tra proprietà e stato? | Le proprietà arrivano dal componente padre; lo stato cambia all’interno del componente con le interazioni.  |
| Perché usare una callback?                | La pagina raccoglie i dati senza dipendere dal modo in cui vengono salvati.                                 |
| Perché disabilitare il pulsante?          | Evita invii senza generi e invii ripetuti durante il salvataggio; il database valida comunque la richiesta. |
| Perché un database?                       | Preferenze dell’app, selezioni, completamenti e voti devono essere conservati e condivisi.                  |
| Spotify è integrato?                      | Il collegamento tramite API è stato rimosso. Rimangono soltanto i link esterni.                             |
