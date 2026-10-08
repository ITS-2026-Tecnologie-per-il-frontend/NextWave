# Documentazione NextWave

La struttura riprende la separazione tra schermate, componenti, hook, servizi, dati e risorse di [PastaTime](https://github.com/ITS-2026-Tecnologie-per-il-frontend/PastaTime/tree/main/pastatime), adattandola al backend, al database e ai test presenti in NextWave. I componenti specifici conservano i propri CSS nella stessa cartella; i fogli condivisi mantengono un punto d'ingresso unico e l'ordine di caricamento precedente.

```text
src/
  app/                   avvio e coordinamento cloud/demo
  assets/brand/          SVG importati dal codice
  components/
    appearance/          personalizzazione e relativi CSS
    brand/               componenti del logo
    contest/             reveal
    dialogs/             finestre e ritaglio avatar
    layout/              struttura dell'interfaccia
    playback/            player
    ui/                  controlli generici
  config/                ambiente, audio, percorsi
  context/               autenticazione, account, player, aspetto
  data/                  generi, preset e catalogo demo
  domain/
    artist/              candidature e quota
    audio/               regole del player
    contest/             selezioni, voto e punteggi
    demo/                classifiche simulate
    shared/              errori, tempo, casualità
  hooks/                 hook React
  screens/
    account/             profilo
    admin/               pannello admin e CSS
    artist/              candidatura
    auth/                accesso e primo avvio
    contest/             selezione giornaliera
    rankings/            classifiche
  services/
    appearance/          persistenza stili
    cloud/               client e repository Supabase
    demo/                persistenza demo
  styles/                token, stili condivisi, responsive
  types/                 contratti condivisi
  main.tsx               punto d'ingresso React

public/
  brand/                 favicon e loghi pubblici
    legacy/              versioni precedenti dei loghi
  images/                artwork
api/                     endpoint Vercel
server/audio/            implementazione server dell'audio
scripts/
  audio/                 gestione audio
  database/              bundle SQL e controllo remoto
  quality/               audit della struttura
tests/
  database/              test PostgreSQL isolati
  fixtures/audio/        campioni sintetici
  helpers/               strumenti condivisi dei test
  integration/           flussi React
  responsive/            collaudo browser isolato
  server/                audio e API
  unit/                  regole pure
supabase/                migrazioni, seed, aggiornamenti e operazioni
docs/
  archive/               decisioni e patch storiche
  database/              schema e selezioni
  deployment/            storage e pubblicazione
  development/           architettura, organizzazione e audit grafici
  features/              funzionalità del prodotto
  planning/              sviluppi futuri
```

## Guide

- [Organizzazione e convenzioni](development/organizzazione.md)
- [Architettura](development/architecture.md)
- [Navigazione con React Router](development/react-router.md)
- [Dati condivisi con Context API](development/context-api.md)
- [Database e Supabase](database/supabase.md)
- [Audio e pubblicazione](deployment/audio-storage.md)
- [Contest reali](features/real-contests.md)
- [Navigazione e scoperte salvate](features/contest-favorites.md)
- [Pannello admin](features/admin-console.md)
- [Seconda revisione responsive](development/responsive-refresh.md)
- [Prossimi passi](planning/prossimi-passi.md)

I file di configurazione richiesti da Vite, TypeScript, npm, Vercel e gli ambienti locali restano nella radice. I nomi dei comandi npm e i percorsi del database non cambiano. Non sono create cartelle vuote per funzionalità assenti: `i18n/` andrà aggiunta quando esisteranno traduzioni da organizzare.

`npm run audit:structure` verifica import e CSS, collocazione dei moduli, riferimenti della documentazione e risorse pubbliche. `npm run check` e `npm run build` verificano l'intero frontend; `npm run db:test` verifica anche l'avvio delle prove PostgreSQL dalla nuova cartella.
