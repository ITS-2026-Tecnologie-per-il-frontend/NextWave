# Vibe Pulse

Frontend React per la scoperta di artisti emergenti: cinque audio giornalieri personalizzati, un voto e reveal alle 21:00 Europe/Rome. Interfaccia italiana, responsiva, con cinque palette.

## Avvio

Richiede Node.js 22.12 o successivo (oppure 20.19 o successivo).

```sh
npm ci
npm start
```

Apri http://127.0.0.1:4173. Lo sviluppo usa Vite: non occorre servire i sorgenti JSX attraverso Apache/XAMPP.

```sh
npm test
npm run build
npm run preview
npm run format:check
```

`npm run build` genera `dist/`; `npm run preview` permette di provare la versione compilata. Il deploy automatico su GitHub Pages è stato rimosso dal repository. Eventuali impostazioni Pages o pubblicazioni già presenti su GitHub vanno disattivate nel repository remoto: questa modifica locale non le cambia.

## Regole di ascolto

- I cinque brani si ascoltano in ordine. All’inizio è disponibile solo il primo.
- Il successivo si sblocca alla fine naturale dell’audio, dopo averne riprodotto l’intera durata. Premere play, mettere in pausa o saltare alla fine non registra un completamento.
- Si può mettere in pausa e riprendere, oppure riascoltare i brani già completati.
- Il player mostra la durata effettiva del file. Gli audio demo attuali durano circa 12 secondi: il controllo copre tutto il file disponibile, non un brano commerciale completo. Per il prodotto reale occorrono i file completi autorizzati.
- Il voto si sblocca dopo cinque completamenti. È unico per profilo/browser/giorno e si chiude alle 21:00 Europe/Rome.
- I completamenti vengono conservati tra ricaricamenti. Un ascolto parziale riparte dall’inizio dopo un ricaricamento.
- Il cambio giorno ferma il player e genera una nuova selezione. I gusti modificati valgono per la selezione successiva.
- Il reveal di prova cambia solo la presentazione: non sblocca audio o voti.

## Funzioni mantenute

Onboarding con collegamento Spotify simulato, scelta dei generi, selezione deterministica pesata sulle esposizioni, classifiche per genere giornaliere e settimanali, reveal dei cinque artisti, scoperte salvate, candidature con validazione, profilo, diario dei voti e cinque temi.

## Struttura

- `src/App.jsx`: coordina navigazione, stato e dialoghi.
- `src/pages/`: onboarding, ascolti giornalieri, classifiche, profilo e candidatura.
- `src/components/`: layout, dialoghi, risultati e controlli condivisi.
- `src/hooks/`: player e orologio Europe/Rome.
- `src/domain/`: regole pure per selezione, completamento, voto, ranking e candidature.
- `src/services/storage.js`: lettura, validazione, migrazione e scrittura dei dati locali.
- `src/data/`: catalogo dimostrativo e temi.
- `src/styles.css`: stile condiviso.
- `public/`: cinque WAV originali e artwork.
- `tests/`: regole e flussi React, con audio e orologio controllati.
- `docs/architecture.md`: proposta per backend, database e integrazione Spotify.

## Migrazione dei dati

La chiave `vibepulse-v1` resta invariata. Profilo, generi, selezioni, scoperte, candidature e voti esistenti vengono conservati. Gli avvii salvati dalla versione precedente non provano un ascolto completo e sono azzerati nella lista dei completamenti; i voti già espressi restano nello storico. Le nuove selezioni/completamenti sono marcati con `completionVersion: 2`.

## Stato reale dell’integrazione

Spotify non è ancora collegato: il pulsante è esplicitamente una simulazione. Non vengono chieste credenziali né inviati dati a Spotify. Catalogo, audio, risultati e candidature sono dimostrativi; le candidature non entrano automaticamente nel contest. I link Spotify aprono ricerche per genere perché i brani sono inventati.

I dati sono salvati solo in localStorage. Non esistono account reali, database o sincronizzazione tra dispositivi. La lettura del voto prima della conferma riduce conflitti tra schede, ma non garantisce unicità atomica. I controlli del browser non costituiscono protezione antiabuso. Le identità del catalogo sono nei sorgenti: l’anonimato è visivo.

Il prodotto reale richiede un backend che controlli selezioni, ascolti, voti e reveal, più un database condiviso. Per preservare l’ascolto al buio bisogna usare audio autorizzati esterni a Spotify: la policy Spotify richiede i metadati e la copertina durante lo streaming. Vedi i riferimenti e i limiti documentati in `docs/architecture.md`.
# NextWave
