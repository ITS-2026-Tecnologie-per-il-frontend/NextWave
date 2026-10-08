# Organizzazione del codice

## Percorso di una richiesta

`main.tsx` carica `app/App.tsx`, che valida la configurazione e sceglie la modalità. In cloud, `CloudApp.tsx` gestisce l'accesso e `CloudAccount.tsx` coordina le schermate dell'account. Le schermate raccolgono dati e ricevono funzioni tramite proprietà. `services/cloud/cloudRepository.ts` traduce le operazioni in RPC Supabase. Il database applica i permessi e le regole del contest.

`main.tsx` monta `BrowserRouter`; `app/routing/AccountRoutes.tsx` definisce le pagine annidate nel layout con `Outlet`. Il menu usa `NavLink` e i callback usano `useNavigate`. Dettagli, URL e configurazione del server sono in [react-router.md](react-router.md).

La demo usa `DemoApp.tsx`, `demoProfileStorage.ts` e il catalogo inventato. La chiave localStorage resta invariata per conservare i dati salvati.

## Dove aggiungere codice

I componenti React usano `.tsx`; hook, servizi, configurazione e regole usano `.ts`. I tipi dei dati condivisi sono in `src/types/models.ts`; le proprietà specifiche di una pagina sono definite accanto al componente. Usare `import type` per i riferimenti utilizzati solo come tipi.

TypeScript è configurato in modalità `strict`, senza disattivare i controlli con `any` o direttive di esclusione. I dati di localStorage entrano come `unknown` e vengono verificati prima dell'uso. I tipi delle risposte RPC descrivono il contratto delle funzioni SQL; non sostituiscono una validazione a runtime delle risposte del server.

- Una pagina completa va in `screens/<funzione>/`; un elemento riutilizzabile in `components/<funzione>/`. I controlli generici restano in `components/ui/`.
- Un hook esportato va in `hooks/`, in un file con lo stesso nome. I componenti chiamano gli hook, ma non esportano hook insieme al proprio rendering.
- Una funzione indipendente da React, rete e persistenza va in `domain/artist/`, `domain/audio/`, `domain/contest/`, `domain/demo/` o `domain/shared/` secondo la responsabilità.
- L'accesso al database va in `services/cloud/`; gli stili personali in `services/appearance/`; la persistenza della demo in `services/demo/`.
- Le variabili di ambiente si validano in `config/environment.ts`; i percorsi delle pagine sono in `config/routes.ts`.
- I dati inventati e le classifiche simulate sono identificati come demo.
- Gli stili specifici si aggiungono accanto al componente; quelli condivisi in `styles/`. `styles/index.css` conserva l'ordine di caricamento, con responsive per ultimo.
- Artwork pubblico in `public/images/`, loghi pubblici in `public/brand/`, SVG importati dal codice in `assets/brand/`; dati e fixture dei test restano in `tests/fixtures/`.
- Comandi operativi in `scripts/<funzione>/`; test del database in `tests/database/`. Il nome del comando npm resta il punto d'ingresso stabile.

Evitare moduli generici come `utils.ts` e nomi che non descrivono una responsabilità. I componenti di pagina ricevono le operazioni di salvataggio tramite proprietà, senza eseguire query direttamente.

## File mantenuti e rimossi

Sono stati rimossi `.DS_Store`, la configurazione vuota del vecchio hosting e le copie SQL generate. Il seed locale legge `supabase/seeds/demo.sql`, senza duplicarlo. I bundle si rigenerano con `npm run db:bundle`.

Le vecchie migrazioni Spotify restano nello storico: quella successiva rimuove l'integrazione. Modificare una migrazione già applicata renderebbe incoerente lo storico degli ambienti. Gli aggiornamenti manuali sono raccolti in `supabase/updates/`.

Le vecchie decisioni Spotify sono conservate in `docs/archive/`. Artwork e audio pubblici sono utilizzati dall'app e dal seed e restano in `public/`.

## Ambiente e controlli

`.env.local` resta nella radice e non viene versionato. `.env.example` contiene solo nomi delle variabili e valori di esempio. Le credenziali del file locale non sono state cambiate.

Prima di consegnare eseguire `npm run check` e `npm run build`; per modifiche al database anche `npm run db:test`. Entrambi i primi comandi includono il controllo TypeScript, anche per i test React. `npm run typecheck` permette di eseguirlo separatamente. L'audit controlla i riferimenti ai moduli e la collocazione degli hook; i test verificano i flussi e le regole. Il generatore SQL usa `tsx` per importare il catalogo TypeScript anche sulle versioni Node supportate che non eseguono direttamente file `.ts`.
