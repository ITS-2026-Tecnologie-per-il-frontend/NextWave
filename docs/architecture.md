# Architettura proposta per il prodotto reale

## Responsabilità

React gestisce l’interfaccia. Un backend gestisce autenticazione, integrazione Spotify, selezioni giornaliere, verifica degli ascolti, voti, candidature e reveal. Il database conserva i dati propri di Vibe Pulse: le API Spotify non sostituiscono questa persistenza.

Una base relazionale come PostgreSQL è adatta ai vincoli di unicità e alle transazioni necessari per un voto al giorno. Il progetto ora usa Supabase per PostgreSQL, Auth e RPC, e Vercel per il frontend. Schema implementato, vincoli e configurazione sono descritti in [supabase.md](supabase.md).

## Dati da conservare

| Entità              | Dati e vincoli                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Utenti              | ID interno, identità di accesso, nome, tema, consensi                                          |
| Preferenze          | Generi scelti, origine e data aggiornamento; applicazione alla selezione successiva            |
| Connessioni Spotify | ID Spotify, scope concessi, scadenza e token protetti lato server; revoca/disconnessione       |
| Brani candidati     | ID interno e Spotify opzionale, genere curato, diritti, file audio autorizzato, stato verifica |
| Contest             | Giorno Europe/Rome, chiusura, stato reveal                                                     |
| Selezioni           | Cinque slot per utente e contest; unicità dello slot e del brano                               |
| Ascolti             | Selezione, slot, sessione e completamento validato                                             |
| Voti                | Utente, contest, selezione e slot; vincolo UNIQUE(utente, contest)                             |
| Preferiti           | Utente e brano; vincolo di unicità                                                             |
| Esposizioni         | Eventi condivisi per calcolare ranking e distribuzione                                         |

Salvare soltanto i dati necessari e consentiti. Non copiare il catalogo Spotify o gli audio nel database. Separare i dati interni dalle eventuali cache Spotify, con gestione delle scadenze e cancellazione alla disconnessione secondo i termini applicabili.

## Regole lato server

1. Generare e conservare cinque slot in una transazione usando il giorno di Roma.
2. Consegnare prima del reveal soltanto gli identificativi anonimi e i dati pubblicabili.
3. Autorizzare la riproduzione del primo slot incompleto e degli slot già completati.
4. Gestire sessioni di ascolto e avanzamento con il tempo server. Non fidarsi del solo evento `ended` o di una richiesta del client che dichiara il completamento. Anche sessioni e heartbeat non provano che una persona abbia prestato attenzione.
5. Accettare il voto in una transazione soltanto dopo cinque completamenti, entro la chiusura server e con vincolo unico. Il client non decide l’orario reale.
6. Calcolare ranking condivisi e rilasciare le identità alla chiusura.

## Spotify: fattibilità verificata il 5 ottobre 2026

- OAuth con Authorization Code + PKCE può autorizzare l’accesso alle funzioni consentite, richiedendo gli scope necessari. Non inserire un client secret nel bundle React.
- Il servizio Top Items permette di leggere artisti/brani principali con `user-top-read`. Non esiste una risposta equivalente a una lista definitiva dei generi preferiti dell’utente. Il campo dei generi degli artisti è marcato deprecato e può essere vuoto: non basare il funzionamento dell’app su quel campo. La scelta esplicita dei generi rimane la base; ogni personalizzazione derivata da Spotify richiede anche valutazione delle policy sui profili e sulle analisi.
- Metadati, ricerca, libreria e playlist hanno funzioni utilizzabili in base a scope e modalità di accesso; non presumere che tutti gli endpoint siano disponibili. Usare le API aggiornate e gestire revoca, 401, 403 e rate limit 429.
- Le nuove app in Development Mode richiedono Premium al proprietario e hanno un limite di cinque utenti autorizzati. Esistono eccezioni per app precedenti e modalità Extended Quota. Questo va chiarito prima di pianificare un lancio pubblico.
- La riproduzione completa tramite Web Playback SDK richiede Premium per l’ascoltatore. Non è una sorgente di file MP3/WAV scaricabili.
- La policy richiede copertina e metadati pertinenti durante la riproduzione Spotify: il player anonimo di Vibe Pulse non è compatibile con quel requisito. Inoltre vieta giochi e alcune analisi/profilazioni: valutare il formato del contest prima di usare streaming Spotify.
- Gli ascoltatori mensili non sono un campo documentato dei dati artista Web API. Follower e popolarità non equivalgono agli ascoltatori mensili; la soglia sotto 10.000 necessita di una verifica separata.

Per il contest al buio, usare brani completi forniti dagli artisti con diritti e autorizzazioni verificati, ospitati in uno storage per file. Usare Spotify come integrazione accessoria per collegamenti e funzioni consentite. La progettazione dell’integrazione reale resta successiva alla verifica della fattibilità e alla disponibilità di un’app Spotify registrata.

## Documentazione ufficiale

- [Top Items e campi restituiti](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)
- [Authorization Code con PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [Migrazione Development Mode 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- [Quick start del player](https://developer.spotify.com/documentation/web-playback-sdk/tutorials/getting-started)
- [Dati artista](https://developer.spotify.com/documentation/web-api/reference/get-an-artist)
- [Spotify Developer Policy, in particolare II.5 e III](https://developer.spotify.com/policy)
