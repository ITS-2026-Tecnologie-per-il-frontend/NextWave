# Vibe Pulse

Web app dimostrativa completa, realizzata sul pitch fornito. Interfaccia in italiano, dark neon, desktop e mobile. Nessuna dipendenza da installare.

## Avvio su macOS

Con Node.js installato, apri Terminale nella cartella `vibe-pulse` ed esegui:

```sh
npm start
```

Apri http://127.0.0.1:4173. Per i controlli automatici: `npm test`.

## Pubblicazione su GitHub Pages

Il repository include un workflow GitHub Actions in `.github/workflows/deploy-pages.yml`.
Per pubblicare il sito:

1. Carica la cartella `VIBE-PULSE` in un repository GitHub.
2. In **Settings > Pages**, imposta **Source** su **GitHub Actions**.
3. Esegui un push sul branch `main` oppure avvia manualmente il workflow dalla scheda **Actions**.

Il workflow controlla i test, verifica la sintassi dei file JavaScript e pubblica direttamente `dist`, senza modificare il comportamento dell'applicazione. Il routing a hash e i percorsi relativi rendono il sito compatibile anche con gli URL dei project pages.

## Percorso di prova

1. Completa l’onboarding e collega Spotify simulato, oppure continua senza.
2. Scegli i generi e avvia tutti e cinque gli estratti di 12 secondi: ogni ascolto conta appena parte la riproduzione, anche se passi subito al successivo.
3. Vota un solo brano e conferma nel dialogo. Il voto resta salvato ricaricando la pagina.
4. Usa “Prova il reveal” per vedere il popup con la classifica dei tuoi cinque brani, quindi salva le scoperte. Dopo il reveal puoi riaprirlo con “Rivedi la classifica”.
5. Consulta classifiche giornaliere e settimanali per genere.
6. Prova la candidatura artista: sono ammessi da 0 a 9.999 ascoltatori, link Spotify a un brano, genere, lingua, sottogenere, mood e dichiarazione dei diritti.
7. Apri il profilo anche dall’icona utente in basso a sinistra; clicca sul logo Vibe Pulse per tornare ai cinque brani. Modifica il profilo: i nuovi generi si applicano dal giorno seguente.

## Colori del profilo

In **Il tuo profilo → Il tuo stile** puoi scegliere tra cinque palette: Neon Pulse (lime e viola), Midnight Trap (lilla e fucsia), Ocean House (ciano e azzurro), Sunset Pop (pesca e rosa) e Golden Jazz (oro e crema). La scelta aggiorna subito tutta l’interfaccia e viene salvata su questo browser, senza cambiare gusti musicali, selezione giornaliera o voto. Il tema iniziale è Neon Pulse.

## Generi disponibili

Indie, Pop, Hip hop, Elettronica, R&B, Trap, Rap, Drill, Rock, Dance, House, Techno, Reggaeton, Afrobeat e Jazz. Lo stesso elenco è disponibile nella scelta iniziale, nel profilo, nei filtri delle classifiche e nella candidatura artista. Ogni genere ha cinque candidati demo.

## Regole

- Il pitch più recente prevede una selezione personale, non una selezione identica per tutti: la demo segue il pitch.
- Cinque candidati unici nel bacino dei generi scelti, estrazione casuale deterministica per giorno e profilo, pesata inversamente alle esposizioni. La selezione è conservata fino al cambio giorno.
- Un ascolto viene registrato al primo avvio effettivo della riproduzione; pausa e ripetizioni non lo duplicano. Un audio che non parte non viene conteggiato. Un solo voto per profilo/browser/giorno, dopo tutti e cinque gli ascolti e prima delle 21:00 Europe/Rome.
- Reveal delle identità alle 21:00, con gestione dell’ora legale e cambio selezione a mezzanotte. Il pulsante di prova cambia solo la presentazione, senza alterare l’orologio.
- Il popup del reveal mostra tutti i cinque artisti della selezione, ordinati per punteggio, e mette in evidenza il primo e il voto dell’utente. Si apre una volta per il contest più recente concluso, anche rientrando il giorno dopo; il reveal di prova non segna il risultato reale come già visto.
- Classifiche separate per genere: voti/esposizioni. Le settimanali aggregano sette giorni e mostrano l’ultima settimana conclusa domenica alle 21:00. Prima del reveal si mostra la giornata precedente.
- I risultati sono dati demo riproducibili. Nella classifica giornaliera e nel popup le esposizioni della selezione e il voto locale si sommano ai dati dimostrativi.

## Confini della demo

Spotify non è collegato realmente. Gli artisti sono inventati e gli audio sono cinque composizioni strumentali sintetiche originali; i 75 candidati riutilizzano questi cinque estratti, assegnati ai cinque slot della selezione per evitare ripetizioni nella stessa sessione. Gli audio sono segnaposto e non rappresentano fedelmente tutti i generi selezionabili. I link del reveal aprono una ricerca per genere su Spotify, non un brano inesistente.

Profilo, ascolti, voto, preferiti e candidature sono conservati in localStorage, su questo browser. Non esistono account reali, sincronizzazione fra dispositivi o database condiviso. Il vincolo di voto è applicativo e non un sistema antiabuso: cancellare i dati del browser può aggirarlo. Le identità fanno parte dei dati JavaScript della demo, quindi l’anonimato è visivo, non garantito contro l’ispezione del codice.

Le candidature demo restano “da verificare” e non entrano automaticamente nella selezione: mancano verifica degli ascoltatori, approvazione, audio dell’artista e verifica dei diritti. La pubblicazione di un prodotto reale richiede backend, autenticazione, protezione delle identità fino al reveal, voto atomico, metriche condivise e integrazione Spotify autorizzata.

## Struttura

- `dist/index.html`: ingresso app
- `dist/app.js`: interfaccia, player e flussi
- `dist/core.js`: catalogo e regole
- `dist/style.css`: stile responsivo
- `dist/audio`: audio demo WAV, originali
- `dist/art.png`: artwork generato
- `tests/core.test.mjs`: controlli sulle regole centrali
- `server.mjs`: server locale

Il font remoto è opzionale: in sua assenza vengono utilizzati i font di sistema.
# VIBE-PULSE
