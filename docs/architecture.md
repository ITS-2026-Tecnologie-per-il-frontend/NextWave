# Architettura proposta per il prodotto reale

## Responsabilità

React gestisce l’interfaccia. Un backend gestisce autenticazione, selezioni giornaliere, verifica degli ascolti, voti, candidature e reveal. Il database conserva i dati di Next Wave.

Una base relazionale come PostgreSQL è adatta ai vincoli di unicità e alle transazioni necessari per un voto al giorno. Il progetto ora usa Supabase per PostgreSQL, Auth e RPC, e Vercel per il frontend. Schema implementato, vincoli e configurazione sono descritti in [supabase.md](supabase.md).

## Dati da conservare

| Entità          | Dati e vincoli                                                                            |
| --------------- | ----------------------------------------------------------------------------------------- |
| Utenti          | ID interno, identità di accesso, nome, tema, consensi                                     |
| Preferenze      | Generi scelti, origine e data aggiornamento; applicazione alla selezione successiva       |
| Brani candidati | ID interno e link Spotify, genere curato, diritti, file audio autorizzato, stato verifica |
| Contest         | Giorno Europe/Rome, chiusura, stato reveal                                                |
| Selezioni       | Cinque slot per utente e contest; unicità dello slot e del brano                          |
| Ascolti         | Selezione, slot, sessione e completamento validato                                        |
| Voti            | Utente, contest, selezione e slot; vincolo UNIQUE(utente, contest)                        |
| Preferiti       | Utente e brano; vincolo di unicità                                                        |
| Esposizioni     | Eventi condivisi per calcolare ranking e distribuzione                                    |

Conservare i dati necessari a profili, contest e candidature. Il collegamento agli account Spotify e la gestione dei token sono stati rimossi.

## Regole lato server

1. Generare e conservare cinque slot in una transazione usando il giorno di Roma.
2. Consegnare prima del reveal soltanto gli identificativi anonimi e i dati pubblicabili.
3. Autorizzare la riproduzione del primo slot incompleto e degli slot già completati.
4. Gestire sessioni di ascolto e avanzamento con il tempo server. Non fidarsi del solo evento `ended` o di una richiesta del client che dichiara il completamento. Anche sessioni e heartbeat non provano che una persona abbia prestato attenzione.
5. Accettare il voto in una transazione soltanto dopo cinque completamenti, entro la chiusura server e con vincolo unico. Il client non decide l’orario reale.
6. Calcolare ranking condivisi e rilasciare le identità alla chiusura.

## Link esterni e sviluppi futuri

I link Spotify presenti sono semplici collegamenti esterni e non richiedono API. Le funzioni Vercel in `api/audio.ts` autorizzano il caricamento e la riproduzione su Supabase Storage privato. La pulizia automatica è stata sospesa: i file audio rimangono nello Storage e vengono gestiti manualmente. Vedere [audio-storage.md](audio-storage.md).
