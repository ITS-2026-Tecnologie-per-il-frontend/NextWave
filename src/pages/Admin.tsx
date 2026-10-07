import { useCallback, useEffect, useRef, useState } from "react";
import type { CloudRepository } from "../services/cloudRepository.ts";
import type { AdminApplication, AdminDashboard } from "../types/models.ts";
import { getErrorMessage } from "../domain/errors.ts";
import { rome } from "../domain/time.ts";
import { Heading } from "../components/ui/Heading.tsx";

function contestDate(offset: number) {
  const date = new Date(`${rome().day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function ReviewCard({
  application,
  repository,
  onReviewed,
  disabled,
}: {
  application: AdminApplication;
  repository: CloudRepository;
  onReviewed: () => Promise<void>;
  disabled: boolean;
}) {
  const [day, setDay] = useState(() => contestDate(1));
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [audioUrl, setAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  async function preview() {
    setBusy(true);
    setError("");
    try {
      setAudioUrl((await repository.adminPreview(application.id)).audioUrl);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!decision) return;
    setBusy(true);
    setError("");
    try {
      await repository.adminAction(decision, {
        applicationId: application.id,
        day,
        note,
        checks,
      });
      setDecision(null);
      setAudioUrl("");
      await onReviewed();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const pending = application.status === "pending";
  const submittedAt = application.submittedAt ?? application.created;
  return (
    <article className="panel admin-review">
      <div className="admin-row">
        <div>
          <h3>{application.title}</h3>
          <p>
            {application.artist} · {application.genre} · {application.language}
          </p>
        </div>
        <span className="badge">
          {pending
            ? "In attesa"
            : application.status === "approved"
              ? "Approvata"
              : "Rifiutata"}
        </span>
      </div>
      {submittedAt && (
        <p className="hint">
          Candidatura inviata il{" "}
          <time dateTime={submittedAt}>
            {new Date(submittedAt).toLocaleString("it-IT", {
              timeZone: "Europe/Rome",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
          </time>{" "}
          · Ora italiana
        </p>
      )}
      <p className="hint">
        {application.listeners} ascoltatori mensili dichiarati ·{" "}
        {application.subgenre} · {application.mood}
        {application.duration
          ? ` · ${Math.ceil(application.duration)} secondi`
          : ""}
      </p>
      <a
        className="textbtn"
        href={application.spotify}
        target="_blank"
        rel="noopener noreferrer"
      >
        Verifica il brano su Spotify ↗
      </a>
      {application.contestDay && (
        <p>
          Contest del{" "}
          {new Date(`${application.contestDay}T12:00:00`).toLocaleDateString(
            "it-IT",
          )}
        </p>
      )}
      {application.requestedDay &&
        application.contestDay &&
        application.contestDay > application.requestedDay && (
          <p className="hint">
            In lista di attesa: i posti precedenti del genere sono occupati.
            Data assegnata automaticamente in ordine di invio.
          </p>
        )}
      {application.reviewNote && (
        <p>Nota di revisione: {application.reviewNote}</p>
      )}
      {pending && !application.reviewable && (
        <p className="hint">
          {application.audioState === "ready"
            ? "Termine di revisione scaduto."
            : "Audio non ancora pronto per la revisione."}
        </p>
      )}
      {(application.reviewable || application.status === "approved") && (
        <div className="admin-audio">
          <button
            className="btn secondary"
            disabled={busy || disabled}
            onClick={() => void preview()}
          >
            Carica ascolto privato
          </button>
          {audioUrl && (
            <>
              <audio
                controls
                src={audioUrl}
                preload="none"
                aria-label={`Ascolta ${application.title}`}
              />
              <p className="hint">
                L’ascolto privato scade dopo 10 minuti. Puoi ricaricarlo.
              </p>
            </>
          )}
        </div>
      )}
      {application.reviewable && (
        <fieldset disabled={busy || disabled}>
          <legend>Verifica della candidatura</legend>
          {[
            "Ho verificato la corrispondenza tra MP3 e brano Spotify",
            "Ho verificato i requisiti dell’artista e gli ascoltatori mensili",
            "Ho verificato la dichiarazione dei diritti e l’autorizzazione all’uso",
          ].map((label, index) => (
            <label className="admin-check" key={label}>
              <input
                type="checkbox"
                checked={checks[index]}
                onChange={(event) =>
                  setChecks(
                    checks.map((value, i) =>
                      i === index ? event.target.checked : value,
                    ),
                  )
                }
              />
              {label}
            </label>
          ))}
          <div className="formgrid">
            <label>
              Primo giorno disponibile per la candidatura
              <input
                type="date"
                value={day}
                min={contestDate(1)}
                max={contestDate(30)}
                onChange={(event) => setDay(event.target.value)}
              />
            </label>
            <label>
              Nota di revisione / motivo del rifiuto
              <input
                value={note}
                maxLength={1000}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Obbligatorio per rifiutare"
              />
            </label>
          </div>
          <p className="hint">
            Massimo 5 brani per genere e giorno. Se il giorno scelto è pieno, il
            brano passa al primo giorno con un posto libero. La precedenza segue
            l’orario di invio, anche se approvi in un ordine diverso. Le date
            future possono cambiare; il contest iniziato resta fermo.
          </p>
          {decision ? (
            <div className="admin-confirm">
              <p>
                {decision === "approve"
                  ? `Confermi l’approvazione a partire dal ${day}? La data effettiva seguirà i posti disponibili e l’ordine di invio.`
                  : "Confermi il rifiuto di questa candidatura?"}
              </p>
              <div className="actions">
                <button className="btn" onClick={() => void submit()}>
                  Conferma {decision === "approve" ? "approvazione" : "rifiuto"}
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setDecision(null)}
                >
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <div className="actions">
              <button
                className="btn"
                disabled={!checks.every(Boolean) || !day}
                onClick={() => setDecision("approve")}
              >
                Approva e programma
              </button>
              <button
                className="btn secondary"
                disabled={!note.trim()}
                onClick={() => setDecision("reject")}
              >
                Rifiuta candidatura
              </button>
            </div>
          )}
        </fieldset>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export default function Admin({
  repository,
  onAccessLost,
}: {
  repository: CloudRepository;
  onAccessLost: () => void;
}) {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const alive = useRef(true);
  const accessLost = useRef(onAccessLost);
  const calendar = new Map<
    string,
    { day: string; genre: string; titles: string[] }
  >();
  for (const application of data?.applications ?? []) {
    if (
      application.status !== "approved" ||
      application.audioState !== "ready" ||
      application.audioDeletedAt ||
      !application.contestDay ||
      application.contestDay < rome().day
    )
      continue;
    const key = `${application.contestDay}:${application.genre}`;
    const entry = calendar.get(key) ?? {
      day: application.contestDay,
      genre: application.genre ?? "Non indicato",
      titles: [] as string[],
    };
    entry.titles.push(application.title);
    calendar.set(key, entry);
  }
  accessLost.current = onAccessLost;
  const refresh = useCallback(async () => {
    try {
      const result = await repository.adminDashboard();
      if (alive.current) {
        setData(result);
        setError("");
      }
    } catch (error) {
      if (alive.current) {
        setData(null);
        setError(getErrorMessage(error));
        if (getErrorMessage(error).includes("Accesso non autorizzato"))
          accessLost.current();
      }
    }
  }, [repository]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function manage(
    action: "grant" | "revoke",
    values: Record<string, unknown>,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await repository.adminAction(action, values);
      setEmail("");
      setRevokeId(null);
      await refresh();
      setMessage(
        action === "grant"
          ? "Account autorizzato."
          : "Autorizzazione revocata.",
      );
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading title="Pannello admin">
        Gestisci le candidature
        {data?.access.owner ? " e gli account autorizzati" : ""} di Next Wave.
      </Heading>
      <div className="admin-content">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <button
          className="textbtn"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Aggiorna pannello ↻
        </button>
        {!data && !error && <p role="status">Caricamento del pannello…</p>}
        {data && (
          <>
            <section className="panel">
              <h2>Calendario e lista di attesa</h2>
              <p className="hint">
                5 posti per genere al giorno. Le candidature sono ordinate dalla
                prima inviata. I brani oltre il quinto vengono programmati nei
                giorni successivi.
              </p>
              {!calendar.size ? (
                <p>Nessun brano programmato.</p>
              ) : (
                <div className="queue-calendar">
                  <table>
                    <thead>
                      <tr>
                        <th>Contest</th>
                        <th>Genere</th>
                        <th>Posti</th>
                        <th>Brani in ordine di invio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...calendar.values()]
                        .sort(
                          (a, b) =>
                            a.day.localeCompare(b.day) ||
                            a.genre.localeCompare(b.genre),
                        )
                        .map((entry) => (
                          <tr key={`${entry.day}:${entry.genre}`}>
                            <td>
                              {new Date(
                                `${entry.day}T12:00:00Z`,
                              ).toLocaleDateString("it-IT", {
                                timeZone: "Europe/Rome",
                              })}
                            </td>
                            <td>{entry.genre}</td>
                            <td>{entry.titles.length}/5</td>
                            <td>{entry.titles.join(" · ")}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <h2>Candidature</h2>
            <div className="chips">
              {[
                ["pending", "In attesa"],
                ["approved", "Approvate"],
                ["rejected", "Rifiutate"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`chip ${filter === value ? "selected" : ""}`}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label} (
                  {
                    data.applications.filter((item) => item.status === value)
                      .length
                  }
                  )
                </button>
              ))}
            </div>
            {!data.applications.some((item) => item.status === filter) && (
              <p className="panel">Nessuna candidatura in questa sezione.</p>
            )}
            {data.applications
              .filter((item) => item.status === filter)
              .sort(
                (a, b) =>
                  (a.submittedAt ?? a.created ?? "").localeCompare(
                    b.submittedAt ?? b.created ?? "",
                  ) || a.id.localeCompare(b.id),
              )
              .map((application) => (
                <ReviewCard
                  key={application.id}
                  application={application}
                  repository={repository}
                  onReviewed={refresh}
                  disabled={busy}
                />
              ))}
            {data.access.owner && (
              <section className="panel">
                <h2>Account autorizzati</h2>
                <p>
                  Gli admin possono esaminare i brani. Solo il superadmin può
                  gestire gli accessi.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void manage("grant", { email });
                  }}
                >
                  <label>
                    Email dell’account da autorizzare
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <p className="hint">
                    L’utente deve essere già registrato e avere confermato
                    l’email.
                  </p>
                  <button type="submit" className="btn" disabled={busy}>
                    Autorizza admin
                  </button>
                </form>
                <ul className="admin-accounts">
                  {data.accounts.map((account) => (
                    <li key={account.id}>
                      <div>
                        <strong>{account.email}</strong>
                        <br />
                        <span className="hint">
                          {account.owner ? "Superadmin · protetto" : "Admin"}
                        </span>
                      </div>
                      {!account.owner &&
                        (revokeId === account.id ? (
                          <div className="actions">
                            <button
                              className="btn secondary"
                              disabled={busy}
                              onClick={() =>
                                void manage("revoke", { userId: account.id })
                              }
                            >
                              Conferma revoca
                            </button>
                            <button
                              className="textbtn"
                              disabled={busy}
                              onClick={() => setRevokeId(null)}
                            >
                              Annulla
                            </button>
                          </div>
                        ) : (
                          <button
                            className="textbtn"
                            disabled={busy}
                            onClick={() => setRevokeId(account.id)}
                          >
                            Revoca accesso
                          </button>
                        ))}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
