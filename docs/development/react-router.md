# Navigazione con React Router 6

La navigazione segue il modello dichiarativo della dispensa React Router: `BrowserRouter`, `Routes`, `Route`, layout annidato con `Outlet` e `useNavigate`. La dipendenza `react-router-dom` 6.30.6 era già presente; non è stato necessario cambiare versione.

## URL e responsabilità

| URL            | Pagina                      | Accesso                        |
| -------------- | --------------------------- | ------------------------------ |
| `/`            | Reindirizzamento a `/daily` | Account configurato            |
| `/daily`       | Selezione giornaliera       | Account configurato            |
| `/ranks`       | Classifiche                 | Account configurato            |
| `/profile`     | Profilo e personalizzazione | Account configurato            |
| `/artist`      | Candidature                 | Profilo artista                |
| `/admin`       | Pannello admin              | Permesso restituito dal server |
| Altri percorsi | Pagina non trovata          | Account configurato            |

`src/main.tsx` monta un unico `BrowserRouter`. `src/config/routes.ts` contiene i percorsi condivisi. `src/app/routing/AccountRoutes.tsx` definisce le rotte annidate, i reindirizzamenti e la pagina mancante. `Layout` ospita `Outlet`; il menu usa `NavLink`, con indicazione automatica della pagina corrente e collegamenti che supportano l'apertura in un'altra scheda.

Cloud e demo passano gli elementi delle rispettive schermate allo stesso albero di rotte. Lo stato dell'account, i dati giornalieri e l'elemento audio rimangono sopra le rotte: cambiare pagina non rimonta il player. I callback di navigazione usano `useNavigate`; sono stati rimossi lo stato manuale della pagina e gli ascoltatori di `hashchange`.

Autenticazione e onboarding conservano i controlli esistenti. Se un utente apre `/profile` prima di accedere o completare il profilo, vede prima il passaggio richiesto; l'indirizzo rimane disponibile per mostrare la pagina richiesta al termine. I controlli frontend non sostituiscono i permessi Supabase, le RLS o le verifiche server. La revoca admin e il passaggio da artista ad ascoltatore provocano un reindirizzamento con sostituzione della voce di cronologia.

## Compatibilità e pubblicazione

All'avvio, solo i vecchi frammenti di pagina riconosciuti (`#daily`, `#ranks`, `#profile`, `#artist`, `#admin`) vengono convertiti nel nuovo percorso con `history.replaceState`. Le query vengono conservate. Frammenti di autenticazione, token e errori Supabase non vengono modificati.

Il server Vite supporta apertura diretta e ricaricamento delle pagine. `vercel.json` aggiunge un fallback verso `index.html` per gli URL del frontend, escludendo API, cartelle pubbliche e percorsi di file. La configurazione sarà applicata al prossimo deploy; non è stato pubblicato un aggiornamento durante questa modifica.

Se si serve la build con un altro server, occorre configurare lo stesso fallback SPA preservando API e file statici. Il server locale abituale resta `http://127.0.0.1:4173`.

## Verifiche

Le prove comprendono apertura diretta e rimontaggio sullo stesso URL, cronologia indietro/avanti senza voci duplicate, menu attivo, continuità del player, accessi artista/admin, revoca dei permessi, pagina mancante, conversione dei link precedenti e protezione dei frammenti OAuth. I test browser responsive verificano anche i collegamenti del menu su desktop e touch.

La dispensa descrive un modello applicabile al progetto, ma la nota finale sull'ordine delle rotte riflette un comportamento precedente: React Router 6 classifica le rotte per specificità. Non sono stati introdotti parametri dinamici o query inutili nelle pagine che non li richiedono.

Riferimenti: [documentazione React Router 6](https://reactrouter.com/6.30.3/start/tutorial), [rewrites Vercel](https://vercel.com/docs/routing/rewrites).
