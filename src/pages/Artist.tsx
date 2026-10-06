import { getErrorMessage } from "../domain/errors.ts";
import type { FormEvent } from "react";
import type { Application } from "../types/models.ts";
import { useState } from "react";
import { genres } from "../data/genres.ts";
import { validateApplication } from "../domain/applications.ts";
import { Heading } from "../components/ui/Heading.tsx";
import { MAX_AUDIO_BYTES } from "../config/audio.ts";
export default function Artist({
  applications,
  onSubmit,
  cloud = false,
}: {
  applications: Application[];
  onSubmit: (application: Application, audio: File) => void | Promise<unknown>;
  cloud?: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        },
        audio,
      );
      form.reset();
      setError("");
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading title="Fatti sentire">
        Il prossimo brano che lascia il segno potrebbe essere il tuo.
      </Heading>
      <div className="formwrap">
        <div className="panel">
          <span className="eyebrow lime">IL TALENTO PRIMA DEI NUMERI</span>
          <h2>Un posto per chi sta iniziando.</h2>
          <p className="hint">
            Candidatura gratuita per artisti con meno di 10.000 ascoltatori
            mensili. Nessuna posizione a pagamento.
          </p>
        </div>
        <form className="panel" onSubmit={submit}>
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
              <input name="rights" type="checkbox" required /> Confermo di avere
              i diritti sul brano e autorizzo NextWave a conservarlo
              temporaneamente e riprodurlo nel contest.
            </label>
            <p className="hint full">
              {cloud
                ? "Una candidatura attiva per artista. Verifichiamo audio, diritti e link prima del contest. L’audio viene eliminato dopo la chiusura; dati e link restano. Le candidature non esaminate scadono dopo 7 giorni."
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
        {applications.length > 0 && (
          <h2>{cloud ? "Le tue candidature" : "Le tue candidature demo"}</h2>
        )}
        {applications.map((application) => (
          <div key={application.id} className="panel">
            <b>{application.title}</b> · {application.artist}
            <p className="hint">
              {application.genre} · {application.mood} ·{" "}
              {application.status === "approved"
                ? "Approvata"
                : application.status === "rejected"
                  ? "Non accettata"
                  : "In attesa di verifica"}
              {application.contestDay &&
                ` · Contest del ${application.contestDay}`}
              {application.audioDeletedAt
                ? " · Audio eliminato, dati conservati"
                : application.audioState === "uploading"
                  ? " · Caricamento incompleto, scadenza entro 3 ore"
                  : ""}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
