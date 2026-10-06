import { getErrorMessage } from "../domain/errors.ts";
import type { FormEvent } from "react";
import type { Application } from "../types/models.ts";
import { useState } from "react";
import { genres } from "../data/genres.ts";
import { validateApplication } from "../domain/applications.ts";
import { Heading } from "../components/ui/Heading.tsx";
export default function Artist({
  applications,
  onSubmit,
  cloud = false,
}: {
  applications: Application[];
  onSubmit: (application: Application) => void | Promise<unknown>;
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
    setBusy(true);
    try {
      await onSubmit({
        ...data,
        artist: data.artist.trim(),
        title: data.title.trim(),
        listeners: Number(data.listeners),
        id: crypto.randomUUID(),
        created: new Date().toISOString(),
      });
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
              <input name="rights" type="checkbox" required /> Confermo di avere
              i diritti per candidare il brano e autorizzarne l’audio.
            </label>
            <p className="hint full">
              {cloud
                ? "Candidatura salvata nel tuo account, in attesa di verifica. Gli ascoltatori sono autodichiarati; Spotify non è ancora collegato."
                : "Modalità demo: candidatura salvata solo su questo browser. Il numero di ascoltatori è autodichiarato; non viene interrogata Spotify."}
            </p>
            <p className="error full" role="alert">
              {error}
            </p>
            <button className="btn full" type="submit" disabled={busy}>
              Invia candidatura →
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
              {application.genre} · {application.mood} · Da verificare prima
              della selezione
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
