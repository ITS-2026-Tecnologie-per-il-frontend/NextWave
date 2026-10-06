import { getErrorMessage } from "../domain/errors.ts";
import type { RankingPeriod } from "../types/models.ts";
import type { RankingsResult } from "../types/models.ts";
import type { CloudRepository } from "../services/cloudRepository.ts";
import { useEffect, useState } from "react";
import { genres } from "../data/genres.ts";
import { Heading } from "../components/ui/Heading.tsx";
export default function CloudRankings({
  repository,
}: {
  repository: CloudRepository;
}) {
  const [period, setPeriod] = useState<RankingPeriod>("day");
  const [filter, setFilter] = useState("Tutti");
  const [result, setResult] = useState<RankingsResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setResult(null);
    setError("");
    repository
      .rankings(period)
      .then((data) => {
        if (alive) setResult(data);
      })
      .catch((error) => {
        if (alive) setError(getErrorMessage(error));
      });
    return () => {
      alive = false;
    };
  }, [repository, period]);
  return (
    <>
      <Heading title="La musica sale">
        Voti ed esposizioni reali dei contest conclusi.
      </Heading>
      <div className="ranktabs">
        {(
          [
            ["day", "Giornaliera"],
            ["week", "Settimanale"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={value === period ? "active" : ""}
            onClick={() => setPeriod(value)}
          >
            {label}
          </button>
        ))}
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
            Contest concluso il{" "}
            {result.reference.split("-").reverse().join("/")}. Punteggio: voti ÷
            esposizioni × 100.
          </p>
          {!result.rows.length && (
            <p>La classifica apparirà dopo i primi contest conclusi.</p>
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
                      </div>
                      <div className="metrics">
                        <small>
                          {track.votes} voti
                          <br />
                          {track.exposures} esposizioni
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
