# Seconda revisione responsive

8 ottobre 2026. Base sincronizzata con `origin/main`, commit `4d04c52`, prima di iniziare gli interventi. Questa revisione include le nuove funzioni di personalizzazione aggiunte dopo il primo collaudo.

## Contenitori e spazi

Il contenuto desktop viene centrato nello spazio disponibile accanto alla sidebar. Le larghezze massime diventano 1440 px per il contest, 1280 px per profilo/classifiche/admin e 1080 px per l’area artista; il modulo artista è limitato a 900 px e centrato. Le dimensioni comprendono i margini interni del contenitore. I pannelli usano spaziatura fluida da 20 a 28 px e 16 px laterali sui telefoni. Le sezioni del profilo hanno una distanza costante di 20 px.

Il banner del contest ha un’altezza minima più contenuta. Le intestazioni possono andare a capo. Sul telefono le azioni del profilo occupano due colonne, con l’ultima azione su tutta la riga, invece di tre grandi pulsanti impilati.

## Navigazione mobile

Fino a 960 px viene mostrata una barra sospesa con fondo completamente opaco, angoli arrotondati, icona e testo breve. La selezione è evidenziata con una capsula interna; le altre voci rimangono libere da riquadri. L’aspetto riprende il linguaggio dei menu mobili recenti, senza riprodurre effetti Liquid Glass o dichiarare una copia di una specifica versione di iOS.

Il menu conserva le destinazioni e i nomi accessibili originali. Gli account ascoltatore hanno tre voci, artista quattro e admin artista cinque. I pulsanti mantengono almeno 44 px in entrambe le dimensioni, anche a 320 px di larghezza. Il menu arriva a un massimo di 560 px sui tablet, con indicatore di selezione e focus da tastiera. Il fondo segue il colore iniziale della sidebar personalizzata, mantenendosi opaco anche quando lo stile usa sfumature.

Il player mobile ha un contenitore sospeso arrotondato della stessa larghezza massima, distanziato dal menu. Lo spazio riservato alla pagina, le notifiche e lo scorrimento tengono conto di entrambi i controlli e della safe area inferiore. Restano disponibili riproduzione e indietro di dieci secondi.

## Nuove funzioni di personalizzazione

Il carosello degli stili conserva lo scorrimento nel proprio contenitore; le schede si adattano alla larghezza disponibile senza imporre una dimensione minima al documento. Le frecce hanno una superficie di 44 px e i pulsanti per editor e raccolta si impilano sui telefoni.

Nell’editor i controlli e l’anteprima condividono colonne restringibili su desktop. Su tablet l’anteprima precede due colonne di controlli; sui telefoni i controlli occupano una sola colonna. Le schede dell’anteprima diventano righe compatte con titolo, descrizione e azione nell’ordine corretto. La testata, i comandi finali e le azioni della raccolta possono andare a capo. I selettori di colore hanno una superficie di 44 px. Le finestre scorrono internamente e mantengono raggiungibili le azioni finali.

## Collaudo

La suite `npm run test:responsive` ora copre 14 schermate: alle 12 precedenti sono aggiunti editor e raccolta stili popolata. La matrice usa 320, 390, 600, 768, 960, 1024, 1101, 1440 e 2560 px, oltre a 844×390 in orizzontale. Vengono verificati anche i due lati dei breakpoint, campo data delle classifiche, testi lunghi, ritaglio avatar e navigazione touch.

Le nuove prove esercitano tre, quattro e cinque destinazioni, controllano l’opacità del menu e l’assenza di blur, applicano tutti e dieci i preset e simulano 34 px di spazio inferiore riservato. La verifica dei contenuti fuori misura riconosce il carosello come area di scorrimento intenzionale e controlla comunque i bordi del suo contenitore.

Le immagini di revisione sono generate a 390, 768 e 1440 px. Il controllo dei dispositivi fisici rimane utile per tastiera virtuale, barre native del browser e audio. La limitazione di avvio di Firefox su questo computer è descritta nel [primo audit](responsive-audit.md); i progetti disponibili sono Chromium, WebKit e Chromium con input touch.

Esito: 56 prove browser superate, quattro esclusioni intenzionali (immagini duplicate e input touch sui progetti desktop), 42 immagini prodotte per la revisione. Sono passati anche i 110 test funzionali, controllo TypeScript, build di produzione e audit degli import. Le prove funzionali sono state eseguite anche con due processi per separarle dal carico del collaudo browser. La formattazione dei file modificati è verificata.

Questi interventi riguardano il frontend: non richiedono migrazioni del database. Il report e le immagini restano nei percorsi locali ignorati da Git.
