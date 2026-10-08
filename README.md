# Next Wave

[Apri l'app](https://next-wave-iota.vercel.app/)

App React e TypeScript per scoprire artisti emergenti: cinque audio giornalieri personalizzati, un voto e reveal alle 21:00 Europe/Rome. Interfaccia italiana, responsiva, con cinque palette.

## Avvio

Richiede Node.js 22.12 o successivo (oppure 20.19 o successivo).

```sh
npm ci
```

Copia `.env.example` in `.env.local`. Il sito usa `VITE_DATA_MODE=supabase`: configura URL e chiave pubblica per gli account reali. La modalità demo è disattivata. I file `.env.local` restano nella radice, dove Vite li legge, e sono esclusi da Git. Il modello `.env.example` è versionato senza credenziali. Non inserire chiavi service_role o password del database nelle variabili `VITE_`.

```sh
npm start
```

Apri http://127.0.0.1:4173 e accedi con un account reale. Una configurazione mancante viene segnalata, senza mostrare dati inventati.

La navigazione usa React Router 6 con URL di pagina, cronologia del browser e layout condiviso. Configurazione e compatibilità dei vecchi link: [guida React Router](docs/development/react-router.md).

Autenticazione, dati dell'account, player e aspetto condivisi usano [React Context](docs/development/context-api.md). Nome e avatar correnti nella gestione admin richiedono la [migrazione descritta nella guida del pannello](docs/features/admin-console.md).

## Database e pubblicazione

Il database Supabase gestisce profili, preferenze, candidature, selezioni, ascolti completati, voti, scoperte salvate e reveal. RLS e funzioni server proteggono i dati per account, la chiusura del voto e l’ordine degli ascolti. Le classifiche cloud usano soltanto eventi e voti registrati, senza punteggi fittizi.

Gli account cloud possono caricare un’immagine profilo JPG, PNG, WebP o GIF (massimo 5 MB). Gli avatar sono conservati nel bucket privato `nextwave-avatars`, con accesso limitato alla cartella dell’utente.

Il sito mostra solo brani e risultati reali. Il precedente catalogo demo è escluso da selezioni, storico visibile e classifiche. Il modulo artista richiede un MP3 e il link Spotify; il server verifica il file e i moderatori autorizzano il brano per un giorno di contest. Gli audio vengono conservati nello Storage privato, insieme ai dati della candidatura. Calendario delle classifiche ed esenzione mensile admin: [docs/features/real-contests.md](./docs/features/real-contests.md).

Schema, migrazioni, popolamento, regole di accesso e istruzioni Vercel sono descritti in [docs/database/supabase.md](./docs/database/supabase.md). L’utente ha applicato `supabase/generated/setup-demo.sql`; non rieseguire il setup sul database già inizializzato.

Vercel usa `vercel.json`. Sul dashboard occorre impostare `VITE_DATA_MODE`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, aggiungere le variabili server `SUPABASE_SERVICE_ROLE_KEY`, quindi ricompilare con un nuovo deploy. Configurare anche Site URL e redirect autorizzati in Supabase Auth.

## Verifiche

```sh
npm test
npm run typecheck
npm run audit:structure
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
- Il reveal è disponibile dopo la chiusura del contest alle 21:00 Europe/Rome.

## Struttura

Mappa completa e indice delle guide in [docs/README.md](docs/README.md).

- `src/app/App.tsx`: sceglie la modalità e controlla la configurazione.
- `src/app/DemoApp.tsx`: flussi locali precedenti, separati dagli account reali.
- `src/app/CloudApp.tsx`: accesso all'app; `CloudAccount.tsx`: coordinamento dell'account.
- `src/hooks/`: hook React per autenticazione, player e orologio.
- `src/context/`: provider e dati condivisi per autenticazione, account, player e aspetto.
- `src/config/`: validazione dell'ambiente e percorsi delle pagine.
- `src/screens/`: schermate complete, raggruppate per auth, account, contest, classifiche, artisti e admin.
- `src/components/`: elementi riutilizzabili, raggruppati per layout, player, contest, finestre, personalizzazione, brand e UI.
- `src/services/cloud/supabase.ts`: client ufficiale Supabase.
- `src/services/cloud/cloudRepository.ts`: API del database attraverso RPC.
- `src/services/demo/demoProfileStorage.ts`: persistenza e migrazione della sola demo.
- `src/domain/`: regole pure e validazione delle candidature.
- `src/types/models.ts`: contratti condivisi per profili, brani, ascolti e dati del database.
- `src/data/`: generi e temi condivisi; catalogo inventato in `demo/`.
- `src/styles/`: stili condivisi, token e responsive; gli stili specifici sono accanto ai componenti. `index.css` conserva l'ordine di caricamento.
- `supabase/migrations/`: schema e regole versionati.
- `supabase/seeds/`: dati demo separati dalle migrazioni.
- `scripts/database/`, `scripts/audio/` e `scripts/quality/`: comandi operativi divisi per funzione.
- `api/` e `server/audio/`: funzioni Vercel per upload, verifica MP3, audio privati.
- `supabase/operations/`: eventuali interventi amministrativi sul progetto esistente.
- `public/images/` e `public/brand/`: artwork e risorse pubbliche; `src/assets/brand/` contiene i loghi importati dal codice.
- `tests/unit/`, `tests/integration/`, `tests/server/`, `tests/database/` e `tests/responsive/`: prove separate per regole, interfaccia, server, PostgreSQL e layout. I WAV sintetici sono in `tests/fixtures/audio/`.
- `supabase/updates/`: aggiornamenti manuali per database già inizializzati.
- `docs/`: sviluppo, database, funzionalità, pubblicazione e pianificazione; `docs/archive/` conserva documenti e patch storiche.

Le migrazioni e il seed sono le fonti del database. `npm run db:bundle` genera `supabase/generated/setup.sql` e `supabase/generated/setup-demo.sql`, esclusi da Git perché riproducibili. Lo stack locale legge direttamente `supabase/seeds/demo.sql`, senza una seconda copia. I setup si usano solo per progetti nuovi e vuoti.

`npm run check` esegue audit della struttura, verifica di formattazione e test. L'audit controlla import locali, moduli sorgente non raggiungibili e hook esportati fuori da `hooks/`; non sostituisce i test funzionali. Convenzioni e responsabilità sono descritte in [docs/development/organizzazione.md](./docs/development/organizzazione.md).

## Limiti attuali

Il player demo contiene audio di 12 secondi: ascoltare tutto il file non equivale a riprodurre un brano commerciale completo. I brani reali usano MP3 autorizzati in Storage privato; il collaudo remoto di questo flusso richiede la configurazione descritta in `docs/deployment/audio-storage.md`. Gli heartbeat verificano tempo e avanzamento, ma non dimostrano attenzione umana; prima di un contest pubblico servono ulteriori misure antiabuso.

La vecchia demo conserva i dati nella chiave `vibepulse-v1`. I vecchi avvii non contano come completamenti; i voti demo storici restano nella demo e non vengono importati come voti verificati degli account Supabase.

Le candidature restano in attesa di verifica e non entrano automaticamente nel catalogo. La soglia degli ascoltatori è autodichiarata nella candidatura.

## Rimozione delle API Spotify

Il collegamento agli account Spotify, OAuth/PKCE e le funzioni API sono stati rimossi. I link esterni ai brani e il modulo candidatura attuale restano disponibili; il caricamento diretto non è ancora implementato.

Sul database esistente eseguire una volta `supabase/updates/remove-spotify.sql`: elimina solo credenziali e tentativi OAuth. Le migrazioni precedenti rimangono nello storico. Le variabili Spotify possono essere rimosse da Vercel prima del nuovo deploy. Dettagli e prossimi passi in [docs/planning/prossimi-passi.md](./docs/planning/prossimi-passi.md).
