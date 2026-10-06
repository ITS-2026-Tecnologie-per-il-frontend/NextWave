# Organizzazione del codice

## Percorso di una richiesta

`main.tsx` carica `app/App.tsx`, che valida la configurazione e sceglie la modalità. In cloud, `CloudApp.tsx` gestisce l'accesso e `CloudAccount.tsx` coordina le pagine dell'account. Le pagine raccolgono dati e ricevono funzioni tramite proprietà. `services/cloudRepository.ts` traduce le operazioni in RPC Supabase. Il database applica i permessi e le regole del contest.

La demo usa `DemoApp.tsx`, `demoProfileStorage.ts` e il catalogo inventato. La chiave localStorage resta invariata per conservare i dati salvati.

## Dove aggiungere codice

I componenti React usano `.tsx`; hook, servizi, configurazione e regole usano `.ts`. I tipi dei dati condivisi sono in `src/types/models.ts`; le proprietà specifiche di una pagina sono definite accanto al componente. Usare `import type` per i riferimenti utilizzati solo come tipi.

TypeScript è configurato in modalità `strict`, senza disattivare i controlli con `any` o direttive di esclusione. I dati di localStorage entrano come `unknown` e vengono verificati prima dell'uso. I tipi delle risposte RPC descrivono il contratto delle funzioni SQL; non sostituiscono una validazione a runtime delle risposte del server.

- Una pagina va in `pages/`; un elemento riutilizzabile in `components/`.
- Un hook esportato va in `hooks/`, in un file con lo stesso nome. I componenti chiamano gli hook, ma non esportano hook insieme al proprio rendering.
- Una funzione indipendente da React, rete e persistenza va in `domain/`.
- L'accesso al database o a un servizio esterno va in `services/`.
- Le variabili di ambiente si validano in `config/environment.ts`; i percorsi delle pagine sono in `config/routes.ts`.
- I dati inventati e le classifiche simulate sono identificati come demo.
- Gli stili si aggiungono nel modulo pertinente; `styles/index.css` conserva l'ordine di caricamento.

Evitare moduli generici come `utils.ts` e nomi che non descrivono una responsabilità. I componenti di pagina ricevono le operazioni di salvataggio tramite proprietà, senza eseguire query direttamente.

## File mantenuti e rimossi

Sono stati rimossi `.DS_Store`, la configurazione vuota del vecchio hosting e le copie SQL generate. Il seed locale legge `supabase/seeds/demo.sql`, senza duplicarlo. I bundle si rigenerano con `npm run db:bundle`.

Le vecchie migrazioni Spotify restano nello storico: quella successiva rimuove l'integrazione. Modificare una migrazione già applicata renderebbe incoerente lo storico degli ambienti. Gli aggiornamenti manuali sono raccolti in `supabase/updates/`.

Le vecchie decisioni Spotify sono conservate in `docs/archive/`. Artwork e audio pubblici sono utilizzati dall'app e dal seed e restano in `public/`.

## Ambiente e controlli

`.env.local` resta nella radice e non viene versionato. `.env.example` contiene solo nomi delle variabili e valori di esempio. Le credenziali del file locale non sono state cambiate.

Prima di consegnare eseguire `npm run check` e `npm run build`; per modifiche al database anche `npm run db:test`. Entrambi i primi comandi includono il controllo TypeScript, anche per i test React. `npm run typecheck` permette di eseguirlo separatamente. L'audit controlla i riferimenti ai moduli e la collocazione degli hook; i test verificano i flussi e le regole. Il generatore SQL usa `tsx` per importare il catalogo TypeScript anche sulle versioni Node supportate che non eseguono direttamente file `.ts`.
