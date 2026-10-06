import { getErrorMessage } from "../domain/errors.ts";
import type { FormEvent } from "react";
import type { Application } from "../types/models.ts";
import { useState } from "react";
import { genres } from "../data/genres.ts";
import { validateApplication } from "../domain/applications.ts";
import { Heading } from "../components/ui/Heading.tsx";
import { MAX_AUDIO_BYTES } from "../config/audio.ts";
import { artistQuota } from "../domain/artistQuota.ts";
export default function Artist({
  applications,
  onSubmit,
  cloud = false,
  now = new Date(),
  admin = false,
}: {
  applications: Application[];
  onSubmit: (application: Application, audio: File) => void | Promise<unknown>;
  cloud?: boolean;
  now?: Date;
  admin?: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const quota = artistQuota(applications, cloud, now, admin);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentQuota = artistQuota(applications, cloud, now, admin);
    if (currentQuota.used || currentQuota.uploading) {
      setError(
        currentQuota.used
          ? "Hai già inviato una traccia questo mese."
          : "Hai già un caricamento in corso.",
      );
      return;
    }
    const form = event.currentTarget;
    const fields = new FormData(event.currentTarget);
    const data: Application = {
      artist: String(fields.get("artist") ?? ""),
      title: String(fields.get("title") ?? ""),
      listeners: String(fields.get("listeners") ?? ""),
      subgenre: String(fields.get("subgenre") ?? ""),
      spotify: String(fields.get("spotify") ?? ""),
      genre: String(fields.get("genre") ?? ""),
      language: String(fields.get("language") ?? ""),
      mood: String(fields.get("mood") ?? ""),
      rights: fields.get("rights") === "on",
    };
    const validation = validateApplication(data, applications);
    if (validation) {
      setError(validation);
      return;
    }
    const audio = fields.get("audio");
    if (
      !(audio instanceof File) ||
      !audio.size ||
      audio.size > MAX_AUDIO_BYTES ||
      !/\.mp3$/i.test(audio.name)
    ) {
      setError("Scegli un file MP3 di massimo 10 MB.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(
        {
          ...data,
          artist: data.artist.trim(),
          title: data.title.trim(),
          listeners: Number(data.listeners),
          id: crypto.randomUUID(),
          created: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
        },
        audio,
      );
      form.reset();
      setError("");
      setShowUpload(false);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading title="Il tuo spazio artista">
        {admin
          ? "Segui le tue candidature e carica i brani per le prove."
          : "Segui le tue candidature e condividi una traccia al mese."}
      </Heading>
      <div className="formwrap">
        <div className="panel">
          <span className="eyebrow lime">
            {admin
              ? "ACCOUNT ADMIN · CARICAMENTI PER LE PROVE"
              : "UNA TRACCIA AL MESE, SPAZIO A TUTTI"}
          </span>
          <h2>
            {admin
              ? "Carica una nuova traccia."
              : quota.used
                ? "La tua traccia del mese è stata inviata."
                : "La tua prossima traccia parte da qui."}
          </h2>
          <p className="hint">
            Candidatura gratuita per artisti con meno di 10.000 ascoltatori
            mensili. Nessuna posizione a pagamento.
          </p>
          <p className="hint">
            {admin && !quota.uploading
              ? "Il tuo account admin non ha il limite mensile. Restano i controlli su audio, diritti e approvazione."
              : quota.used
                ? `Potrai inviare una nuova candidatura dal ${quota.nextMonth}. Anche una traccia rifiutata conta nel limite mensile.`
                : quota.uploading
                  ? "Hai un caricamento in corso. Completalo o attendi la sua scadenza."
                  : "Puoi inviare una traccia per mese solare, secondo l’orario italiano. I caricamenti non completati non consumano il limite."}
          </p>
          {!quota.used && !quota.uploading && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => setShowUpload(!showUpload)}
            >
              {showUpload
                ? "Chiudi caricamento"
                : admin
                  ? "Candida un brano"
                  : "Candida la traccia del mese"}
            </button>
          )}
        </div>
        <section aria-labelledby="artist-applications-heading">
          <h2 id="artist-applications-heading">
            {cloud ? "Le tue candidature" : "Le tue candidature demo"}
          </h2>
          {!applications.length && (
            <div className="panel">
              <p>Non hai ancora inviato candidature.</p>
              <p className="hint">
                Dopo l’invio troverai qui lo stato della revisione e il giorno
                del contest.
              </p>
            </div>
          )}
          {[...applications]
            .sort((a, b) => (b.created ?? "").localeCompare(a.created ?? ""))
            .map((application) => (
              <article
                key={application.id}
                className="panel artist-application"
              >
                <div className="row">
                  <div>
                    <h3>{application.title}</h3>
                    <p className="hint">
                      {application.artist} · {application.genre} ·{" "}
                      {application.mood}
                    </p>
                  </div>
                  <span className="badge">
                    {application.status === "approved"
                      ? "Approvata"
                      : application.status === "rejected"
                        ? "Non accettata"
                        : "In attesa di verifica"}
                  </span>
                </div>
                {application.created && (
                  <p className="hint">
                    Inviata il{" "}
                    <time dateTime={application.created}>
                      {new Date(application.created).toLocaleString("it-IT", {
                        timeZone: "Europe/Rome",
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </time>{" "}
                    · Ora italiana
                  </p>
                )}
                {application.contestDay && (
                  <p>
                    Contest del{" "}
                    {new Date(
                      `${application.contestDay}T12:00:00`,
                    ).toLocaleDateString("it-IT")}
                  </p>
                )}
                {application.audioDeletedAt ? (
                  <p className="hint">Audio eliminato, dati conservati.</p>
                ) : application.audioState === "uploading" ||
                  application.audioState === "processing" ? (
                  <p className="hint">
                    Caricamento incompleto: la prenotazione scade entro 3 ore.
                  </p>
                ) : null}
              </article>
            ))}
        </section>
        {showUpload && !quota.used && !quota.uploading && (
          <form className="panel" onSubmit={submit}>
            <h2>
              {admin ? "Candida un brano" : "Candida la traccia del mese"}
            </h2>
            <div className="formgrid">
              <label>
                Nome artista
                <input
                  name="artist"
                  required
                  maxLength={70}
                  placeholder="Il tuo nome d’arte"
                />
              </label>
              <label>
                Titolo del brano
                <input
                  name="title"
                  required
                  maxLength={100}
                  placeholder="Come si chiama il brano?"
                />
              </label>
              <label>
                Ascoltatori mensili su Spotify
                <input
                  name="listeners"
                  type="number"
                  min="0"
                  max="9999"
                  step="1"
                  required
                  placeholder="Es. 2500"
                />
              </label>
              <label>
                Genere
                <select name="genre">
                  {genres.map((genre) => (
                    <option key={genre}>{genre}</option>
                  ))}
                </select>
              </label>
              <label>
                Lingua
                <select name="language">
                  {[
                    "Italiano",
                    "Inglese",
                    "Spagnolo",
                    "Francese",
                    "Altra",
                    "Strumentale",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Sottogenere
                <input
                  name="subgenre"
                  required
                  maxLength={60}
                  placeholder="Es. Bedroom pop"
                />
              </label>
              <label>
                Mood
                <select name="mood">
                  {[
                    "Sognante",
                    "Energico",
                    "Notturno",
                    "Malinconico",
                    "Euforico",
                    "Intimo",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Link del brano su Spotify
                <input
                  name="spotify"
                  type="url"
                  required
                  placeholder="https://open.spotify.com/track/…"
                />
              </label>
              <label className="full">
                Audio per il contest · MP3, massimo 10 MB e 30 minuti
                <input
                  name="audio"
                  type="file"
                  accept=".mp3,audio/mpeg"
                  required
                  disabled={busy}
                />
              </label>
              <label className="full">
                <input name="rights" type="checkbox" required /> Confermo di
                avere i diritti sul brano e autorizzo NextWave a conservarlo
                temporaneamente e riprodurlo nel contest.
              </label>
              <p className="hint full">
                {cloud
                  ? `${admin ? "Caricamenti admin senza limite mensile." : "Una traccia per artista al mese."} Verifichiamo audio, diritti e link prima del contest. Audio, dati e link vengono conservati. La candidatura deve essere esaminata entro 7 giorni.`
                  : "Modalità demo: salviamo solo i dati in questo browser; l’audio non viene caricato. Per inviarlo usa un account NextWave."}
              </p>
              <p className="error full" role="alert">
                {error}
              </p>
              <button className="btn full" type="submit" disabled={busy}>
                {busy
                  ? "Caricamento e verifica dell’audio…"
                  : "Invia candidatura →"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
