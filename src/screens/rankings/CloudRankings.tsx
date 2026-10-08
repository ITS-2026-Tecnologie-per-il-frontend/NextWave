import { getErrorMessage } from "../../domain/shared/errors.ts";
import { SpotifyLink } from "../../components/ui/SpotifyLink.tsx";
import type { RankingPeriod } from "../../types/models.ts";
import type { RankingsResult } from "../../types/models.ts";
import type { CloudRepository } from "../../services/cloud/cloudRepository.ts";
import { useEffect, useState } from "react";
import { genres } from "../../data/genres.ts";
import { Heading } from "../../components/ui/Heading.tsx";
export default function CloudRankings({
  repository,
}: {
  repository: CloudRepository;
}) {
  const [period, setPeriod] = useState<RankingPeriod>("day");
  const [filter, setFilter] = useState("Tutti");
  const [day, setDay] = useState("");
  const [result, setResult] = useState<RankingsResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setResult(null);
    setError("");
    repository
      .rankings(period, day || undefined)
      .then((data) => {
        if (alive) setResult(data);
      })
      .catch((error) => {
        if (alive) setError(getErrorMessage(error));
      });
    return () => {
      alive = false;
    };
  }, [repository, period, day]);
  return (
    <>
      <Heading title="La musica sale">
        Voti ed esposizioni reali dei contest conclusi.
      </Heading>
      <div className="ranktabs" role="group" aria-label="Periodo classifica">
        {(
          [
            ["day", "Giornaliera"],
            ["week", "Settimanale"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={value === period ? "active" : ""}
            aria-pressed={value === period}
            onClick={() => setPeriod(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="panel rankings-date-panel">
        <label>
          {period === "day"
            ? "Giorno della classifica"
            : "Data di riferimento della settimana"}
          <input
            type="date"
            value={day || result?.reference || ""}
            max={result?.latestDay}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
        <button className="textbtn" onClick={() => setDay("")} disabled={!day}>
          Torna all’ultimo contest concluso
        </button>
        {period === "week" && (
          <p className="hint">
            Mostriamo l’ultima settimana conclusa di domenica entro la data
            scelta.
          </p>
        )}
      </div>
      <div className="chips">
        {["Tutti", ...genres].map((genre) => (
          <button
            key={genre}
            className={`chip ${filter === genre ? "selected" : ""}`}
            aria-pressed={filter === genre}
            onClick={() => setFilter(genre)}
          >
            {genre}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!result && !error && <p role="status">Caricamento della classifica…</p>}
      {result && (
        <>
          <p className="hint">
            {period === "day" ? "Classifica del" : "Settimana conclusa il"}{" "}
            {result.reference.split("-").reverse().join("/")}. Punteggio: voti ÷
            esposizioni × 100.
          </p>
          {!result.rows.length && (
            <p>Nessun risultato disponibile per il periodo scelto.</p>
          )}
          {result.rows.length > 0 &&
            filter !== "Tutti" &&
            !result.rows.some((track) => track.genre === filter) && (
              <p>Nessun risultato per questo genere nel periodo scelto.</p>
            )}
          {(filter === "Tutti" ? genres : [filter]).map((genre) => {
            const rows = result.rows.filter((track) => track.genre === genre);
            if (!rows.length) return null;
            return (
              <section key={genre}>
                <h2>{genre}</h2>
                <div className="ranklist">
                  {rows.map((track, index) => (
                    <div className="rankrow" key={track.id}>
                      <span className="position">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{track.title}</strong>
                        <br />
                        <small>{track.artist}</small>
                        <SpotifyLink track={track} />
                      </div>
                      <div className="metrics">
                        <small>
                          <span>{track.votes} voti</span>
                          <span>{track.exposures} esposizioni</span>
                        </small>
                      </div>
                      <span className="score">
                        {(track.score * 100).toFixed(1).replace(".", ",")}
                        <small>%</small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
