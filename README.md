# Vibe Pulse

App React per scoprire artisti emergenti: cinque audio giornalieri personalizzati, un voto e reveal alle 21:00 Europe/Rome. Interfaccia italiana, responsiva, con cinque palette.

## Avvio

Richiede Node.js 22.12 o successivo (oppure 20.19 o successivo).

```sh
npm ci
```

Copia `.env.example` in `.env.local` e configura URL e chiave pubblica Supabase. Il progetto locale è già configurato con i valori forniti dall’utente. Non inserire chiavi service_role o password del database nelle variabili `VITE_`.

```sh
npm start
```

Apri http://127.0.0.1:4173. Con `VITE_DATA_MODE=supabase` è disponibile il login reale; con `VITE_DATA_MODE=demo` puoi usare la demo locale senza account. In produzione una configurazione mancante viene segnalata.

## Database e pubblicazione

Il database Supabase gestisce profili, preferenze, candidature, selezioni, ascolti completati, voti, scoperte salvate e reveal. RLS e funzioni server proteggono i dati per account, la chiusura del voto e l’ordine degli ascolti. Le classifiche cloud usano soltanto eventi e voti registrati, senza punteggi fittizi.

Il catalogo iniziale rimane dimostrativo: 75 candidati inventati e cinque audio sintetici da 12 secondi, marcati come demo. Non sono stati creati utenti o voti fittizi. Spotify non è ancora integrato e i file completi degli artisti devono ancora essere caricati e autorizzati.

Schema, migrazioni, popolamento, regole di accesso e istruzioni Vercel sono descritti in [docs/supabase.md](docs/supabase.md). L’utente ha applicato `supabase/setup-demo.sql`; non rieseguire il setup sul database già inizializzato.

Vercel usa `vercel.json`. Sul dashboard occorre impostare `VITE_DATA_MODE`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, quindi ricompilare con un nuovo deploy. Configurare anche Site URL e redirect autorizzati in Supabase Auth.

## Verifiche

```sh
npm test
npm run db:test
npm run db:check
npm run build
npm run preview
npm run format:check
```

I test dell’interfaccia usano account e risposte controllati, senza scrivere sul database remoto. `db:test` applica le migrazioni a PostgreSQL di test con ruoli Auth simulati. `db:check` verifica il progetto remoto in sola lettura tramite `.env.local`.

## Ascolto giornaliero

- Il primo brano è disponibile subito; ogni successivo si sblocca dopo il completamento confermato del precedente.
- Pausa e ripresa sono consentite. Un salto alla fine non registra il completamento.
- In cloud avanzamento e tempo vengono verificati sul server; il browser non può scrivere direttamente completamenti o voti. Interruzioni di rete possono richiedere di ricominciare il brano.
- Il voto richiede cinque completamenti ed è unico per account/giorno, prima delle 21:00 Europe/Rome. Il database verifica orario e unicità.
- Un ricaricamento conserva i completamenti; gli ascolti parziali ripartono dall’inizio.
- I gusti modificati si applicano alla selezione successiva. Il cambio giorno ferma il vecchio audio.
- Il reveal anticipato è disponibile soltanto nella demo locale.

## Struttura

- `src/App.jsx`: sceglie la modalità e controlla la configurazione.
- `src/DemoApp.jsx`: flussi locali precedenti, separati dagli account reali.
- `src/features/cloud/`: autenticazione, account, player e classifiche Supabase.
- `src/pages/` e `src/components/`: interfaccia condivisa.
- `src/services/supabase.js`: client ufficiale e validazione delle variabili.
- `src/services/cloudRepository.js`: API del database attraverso RPC.
- `src/services/storage.js`: persistenza e migrazione della sola demo.
- `src/domain/`: regole pure e validazione delle candidature.
- `src/data/`: catalogo dimostrativo e temi.
- `supabase/migrations/`: schema e regole versionati.
- `supabase/seeds/`: dati demo separati dalle migrazioni.
- `scripts/`: bundle SQL, test PostgreSQL e controllo remoto.
- `public/`: artwork e cinque WAV sintetici originali.
- `tests/`: test delle regole e dei flussi React.

## Limiti attuali

Il player demo contiene audio di 12 secondi: ascoltare tutto il file non equivale a riprodurre un brano commerciale completo. Per il prodotto reale servono audio completi con diritti verificati e storage privato. Gli heartbeat verificano tempo e avanzamento, ma non dimostrano attenzione umana; prima di un contest pubblico servono ulteriori misure antiabuso.

La vecchia demo conserva i dati nella chiave `vibepulse-v1`. I vecchi avvii non contano come completamenti; i voti demo storici restano nella demo e non vengono importati come voti verificati degli account Supabase.

Le candidature restano in attesa di verifica e non entrano automaticamente nel catalogo. La soglia degli ascoltatori è autodichiarata nella candidatura.

Spotify richiede copertina e metadati durante lo streaming: il contest al buio deve usare audio autorizzati degli artisti. Fattibilità e limiti Spotify sono documentati in [docs/architecture.md](docs/architecture.md).
