# Dati condivisi con React Context

Il progetto applica il modello della dispensa Context API: `createContext`, provider e hook basati su `useContext`. Le responsabilità sono separate per evitare un unico contenitore con stato non correlato.

| Context    | Provider e durata                                  | Dati e operazioni                                                                                                         |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Auth       | `AuthProvider`, durante la sessione dell'app cloud | Sessione, caricamento, errore, client e repository condivisi; una sola sottoscrizione Auth                                |
| Account    | `AccountProvider`, per l'utente autenticato        | Dashboard, stato dei salvataggi, clock server, notifiche, refresh, aggiornamento profilo, logout                          |
| Playback   | Provider sopra tutte le pagine dell'account        | Player attivo, selezione giornaliera, reveal e modalità; il player fisso legge direttamente il context                    |
| Appearance | `AppearanceProvider`, nel layout condiviso         | Stile attivo, raccolta, applicazione e salvataggio; una sola sincronizzazione Storage/eventi e applicazione dei token CSS |

I context sono dichiarati in `src/context/<responsabilità>/`. I provider sono componenti separati; gli hook pubblici (`useAuthContext`, `useAccount`, `usePlayback`, `useCustomStyle`) risiedono in `src/hooks/` e segnalano un provider mancante. I valori composti di autenticazione, account e aspetto sono memoizzati, e le operazioni dell'account usano callback stabili.

`CloudApp` legge il context Auth. Ogni identità monta un account con una chiave distinta: cambiare utente smonta provider, timer e player precedenti. `AccountScreen` legge il context Account e compone le schermate e le azioni locali. Le schermate riutilizzabili possono continuare a ricevere proprietà specifiche, senza conoscere Supabase o dover cambiare contratto per la demo.

Lo stato del player resta sopra React Router: un cambio pagina mantiene lo stesso elemento audio. Anche il passaggio dal caricamento alla dashboard mantiene la stessa struttura del provider e dell'elemento audio. Il menu non trasporta più tutte le proprietà del player al componente fisso.

Editor, finestre di conferma, filtri e bozze dei moduli mantengono stato locale. La bozza dello stile aggiorna soltanto l'anteprima; le operazioni del context salvano e applicano il risultato quando l'utente conferma. La persistenza esistente e le chiavi localStorage sono conservate.

Il refresh dell'account ignora risultati ed errori di richieste superate e risposte successive allo smontaggio. Un evento Auth recente non viene sovrascritto da una lettura iniziale tardiva o fallita. I dati del context sono lo stato dell'interfaccia: autorizzazioni, ascolti e voti continuano a essere verificati dal server.

Verifiche: `npm run check`, `npm run build` e `npm run test:responsive`. Le prove coprono aggiornamenti da discendenti, condivisione dello stile, sottoscrizioni Auth, richieste concorrenti, navigazione e continuità degli ascolti. Il browser di prova avvia un server dedicato, senza riutilizzare server dell'app già aperti. Se la porta predefinita 4174 è occupata, in PowerShell impostare `$env:RESPONSIVE_TEST_PORT = '4184'` prima del comando.

Riferimenti: [createContext](https://react.dev/reference/react/createContext), [useContext](https://react.dev/reference/react/useContext).
