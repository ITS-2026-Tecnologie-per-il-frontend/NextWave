# Revisione responsive — Next Wave

Data: 8 ottobre 2026. La revisione riguarda presentazione e interazione delle pagine; non cambia autenticazione, contest, caricamenti audio o database.

## Ambito dello studio

Sono stati esaminati il contenitore dell’app, la navigazione, la barra superiore, il player, i moduli e gli stili specifici delle pagine. Il collaudo usa i componenti reali con dati in memoria in un’app di prova separata: non richiede accessi, non chiama Supabase e non scrive dati reali. L’app di prova è dentro `tests/responsive`, non viene importata dall’entry point del prodotto e non è inclusa nella compilazione pubblicata.

Le dodici schermate coperte sono accesso, configurazione delle preferenze, contest giornaliero, contest senza candidati, brani dopo il reveal, classifiche cloud, profilo, candidature artista, pannello admin, finestra del reveal, conferma del voto e ritaglio avatar. Il profilo viene verificato anche con modifica nome e personalizzazione avatar aperte; la pagina artista con il modulo di candidatura aperto; l’admin con calendario, candidatura da revisionare e account autorizzati.

## Problemi individuati e interventi

| Area                     | Problema precedente                                                                                           | Comportamento aggiornato                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordine degli stili       | Alcuni stili specifici caricati dopo le regole responsive potevano prevalere sul layout mobile.               | Le regole responsive vengono caricate per ultime e condividono le dimensioni di navigazione e player.                                                                               |
| Tablet                   | La sidebar lasciava poco spazio ai contenuti; le cinque schede rimanevano affiancate fino a 760 px.           | Navigazione inferiore fino a 960 px. Schede compatte a due colonne su tablet e una sui telefoni.                                                                                    |
| Desktop intermedio       | Il player imponeva colonne la cui somma poteva superare la larghezza disponibile.                             | Colonne flessibili, metadati che possono restringersi, volume e indicatore decorativo rimossi solo quando lo spazio è insufficiente.                                                |
| Player mobile            | Il comando indietro era nascosto e gli ingombri del player e del menu venivano definiti separatamente.        | Riproduzione e indietro restano disponibili con pulsanti di almeno 44×44 px. Posizioni e spazio riservato alla pagina derivano dalle stesse variabili.                              |
| Testi lunghi             | Nomi, titoli, email e contenuti delle griglie potevano imporre una larghezza minima troppo grande.            | Griglie con colonne `minmax(0, …)`, elementi restringibili e testo che va a capo. Ellissi limitata ai metadati del player e del menu account.                                       |
| Profilo                  | Nome, azioni e anteprima avatar condividevano righe che diventavano strette.                                  | Azioni su più righe, pulsanti a larghezza piena sui telefoni e personalizzazione avatar disposta verticalmente.                                                                     |
| Scoperte salvate         | Schede libere e link sulla stessa riga potevano diventare troppo larghi o apparire attaccati.                 | Griglia fluida e collegamenti separati.                                                                                                                                             |
| Moduli                   | Le colonne potevano espandersi per la dimensione intrinseca di file, date e testi.                            | Colonne restringibili; modulo singolo sotto 600 px; campi di almeno 16 px per evitare lo zoom automatico dei campi su iPhone.                                                       |
| Classifiche              | La colonna principale non era restringibile; voti ed esposizioni venivano nascosti su mobile.                 | Titoli su più righe e metriche conservate sotto il titolo sui telefoni, con punteggio nella colonna laterale.                                                                       |
| Finestre                 | Solo il reveal aveva un limite esplicito dell’altezza visibile.                                               | Tutte le finestre sono limitate all’altezza disponibile, scorrono internamente e mantengono raggiungibili le azioni. La pagina sottostante non scorre mentre è aperta una finestra. |
| Ritaglio avatar          | Anteprima e trascinamento usavano un’area fissa di 360 px anche quando il cerchio era più piccolo.            | Area misurata quando cambia dimensione; coordinate normalizzate per visualizzazione ed esportazione; trascinamento e riduzione dello zoom limitati ai bordi dell’immagine.          |
| Admin                    | Il calendario aveva bisogno di spazio orizzontale e le azioni di revisione potevano diventare troppo strette. | Scorrimento confinato alla tabella, regione nominata e raggiungibile con la tastiera; azioni impilate sui telefoni.                                                                 |
| Dispositivi con notch    | Spazi laterali e inferiori non erano applicati in modo uniforme.                                              | Margini basati sulle safe area per contenuti, menu, player, accesso e finestre.                                                                                                     |
| Orientamento orizzontale | La parte illustrata del primo accesso e il ritaglio occupavano molta altezza.                                 | Intestazione più compatta e area di ritaglio ridotta nelle finestre basse.                                                                                                          |
| Movimento ridotto        | Alcune animazioni o trasformazioni restavano attive.                                                          | Transizioni, animazioni e scorrimento animato vengono disattivati con la preferenza di movimento ridotto.                                                                           |

Non viene nascosto lo scorrimento orizzontale dell’intera pagina per mascherare elementi fuori misura. La tabella admin e l’immagine di ritaglio mantengono i propri contenitori dedicati.

## Regole di layout

| Larghezza disponibile | Navigazione    | Schede del contest                         |
| --------------------- | -------------- | ------------------------------------------ |
| Fino a 600 px         | Menu inferiore | Una colonna, copertina compatta a sinistra |
| Da 601 a 960 px       | Menu inferiore | Due colonne, schede compatte               |
| Da 961 a 1280 px      | Sidebar        | Tre colonne                                |
| Oltre 1280 px         | Sidebar        | Cinque colonne                             |

Il contenuto ha una larghezza massima di 1600 px e viene centrato nello spazio disponibile accanto alla sidebar sui monitor grandi. I controlli inferiori riservano spazio alla fine della pagina, compresa la safe area. Le preferenze e le palette mantengono la stessa disponibilità in ogni formato.

## Collaudo ripetibile

Gli strumenti di prova sono fissati nel lockfile. Preparazione ed esecuzione:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:responsive
```

Il server di prova usa solo `127.0.0.1:4174`, separato dal frontend di sviluppo su `4173`. La suite è configurata per Chromium, Firefox, WebKit e Chromium in modalità mobile con touch. Le immagini di revisione vengono prodotte una volta su Chromium per evitare duplicati.

Su questo computer Chromium, WebKit e la modalità touch sono eseguibili. Firefox non riesce ad avviarsi per un errore Windows di configurazione affiancata del componente `mozglue`, anche dopo il ripristino del browser di prova. Questa è una limitazione dell’ambiente di collaudo: la compatibilità Firefox non viene dichiarata verificata. Il comando ordinario esegue i tre progetti disponibili; `npm run test:responsive:all` include anche Firefox e richiede che il browser riesca ad avviarsi. L’errore non viene trasformato in un test superato.

| Vista                           | Dimensioni in pixel CSS |
| ------------------------------- | ----------------------- |
| Telefono stretto                | 320×568                 |
| Telefono moderno                | 390×844                 |
| Soglia telefono/tablet          | 600×800                 |
| Tablet verticale                | 768×1024                |
| Soglia della navigazione        | 960×720                 |
| Tablet/desktop piccolo          | 1024×768                |
| Desktop intermedio problematico | 1101×800                |
| Desktop                         | 1440×900                |
| Monitor grande                  | 2560×1440               |
| Telefono orizzontale            | 844×390                 |

Ogni vista esamina tutte e dodici le schermate. Le verifiche misurano lo scorrimento della pagina, la posizione degli elementi, l’assenza di sovrapposizione tra menu e player, la dimensione dei pulsanti principali, il raggiungimento del footer e delle azioni delle finestre. I dati includono titoli lunghi senza spazi, email lunghe, cinque preferenze e cinque candidati.

Sono inoltre verificati testi ereditati ingranditi su telefono e tablet, corrispondenza tra anteprima e JPEG esportato dopo il trascinamento dell’avatar e contenimento del ritaglio durante il cambio di orientamento. Questa prova dei testi non sostituisce tutte le impostazioni di zoom e accessibilità native dei diversi sistemi operativi.

Una prova dedicata verifica i due lati delle soglie a 600/601, 960/961 e 1280/1281 px, misurando anche il numero effettivo delle colonne del contest. La navigazione touch viene esercitata con un tocco reale simulato sul pulsante del profilo.

La suite frontend resta separata: `npm test`. Sono necessari anche `npm run typecheck`, `npm run build` e `npm run audit:structure`. Il report del browser e le immagini sono salvati in `playwright-report` e `test-results/responsive`, ignorati da Git. Per aprire il report locale usare `npx playwright show-report playwright-report`.

## Esito della revisione

Sono passate 47 prove browser tra matrice delle schermate, soglie del layout, testi ingranditi, navigazione touch e ritaglio avatar. Quattro casi sono esclusioni intenzionali: due copie delle immagini di revisione e due prove touch sui progetti senza input touch. Sono state prodotte 36 immagini per il controllo visivo. Sono passati anche i 56 test frontend esistenti, controllo TypeScript, build di produzione e audit della struttura. La formattazione dei file modificati è verificata; il controllo globale conserva avvisi preesistenti nei file estranei alla revisione.

## Limiti e verifica sui dispositivi reali

Il risultato è verificabile nelle dimensioni e nei motori sopra elencati; non costituisce una garanzia su qualsiasi dispositivo o browser mai prodotto. WebKit sul computer di prova verifica il motore di rendering, ma non riproduce integralmente Safari su un iPhone fisico. La modalità touch emula viewport e input, non tutte le funzioni del sistema operativo.

Prima della pubblicazione resta utile una verifica su iPhone/Safari e Android/Chrome reali: aprire accesso e candidature con tastiera virtuale, ruotare il dispositivo, controllare le safe area, ascoltare e riavvolgere un audio reale e scegliere una foto dalla galleria. Queste operazioni dipendono da tastiera, barra del browser, audio e selettore file nativi; i test di layout non sostituiscono il collaudo di quei servizi.

Questa revisione non richiede migrazioni del database. Le modifiche sono testabili nel frontend locale prima di un commit o di una pubblicazione.
