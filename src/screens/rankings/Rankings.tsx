import type { RankingPeriod } from "../../types/models.ts";
import type { Clock, Round } from "../../types/models.ts";
import { useState } from "react";
import { catalog } from "../../data/demo/catalog.ts";
import { genres } from "../../data/genres.ts";
import { dailyRanking, rankRows } from "../../domain/demo/demoRanking.ts";
import { rankingDate } from "../../domain/contest/ranking.ts";
import { Heading } from "../../components/ui/Heading.tsx";
export default function Rankings({
  clock,
  rounds,
}: {
  clock: Clock;
  rounds: Record<string, Round>;
}) {
  const [period, setPeriod] = useState<RankingPeriod>("day");
  const [filter, setFilter] = useState("Tutti");
  const reference = rankingDate(clock, period);
  const rows =
    period === "day"
      ? dailyRanking(reference, rounds)
      : rankRows(catalog, period, reference);
  return (
    <>
      <Heading title="La musica sale">
        Le classifiche di chi si è fatto sentire · Dati demo
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
            className={period === value ? "active" : ""}
            aria-pressed={period === value}
            onClick={() => setPeriod(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="row">
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
          {filter !== "Tutti" && (
            <button
              className="textbtn rankings-reset"
              onClick={() => setFilter("Tutti")}
            >
              Azzera filtro
            </button>
          )}
        </div>
        <span className="hint">
          {period === "week" ? "Settimana conclusa il" : "Contest del"}{" "}
          {reference.split("-").reverse().join("/")}
        </span>
      </div>
      <div className="panel">
        <h3>Conta la risposta, non la notorietà.</h3>
        <p className="hint">
          Punteggio = voti ÷ esposizioni × 100. Le posizioni vengono confrontate
          all’interno di ogni genere. La settimanale somma sette giorni e si
          chiude domenica alle 21:00.
        </p>
      </div>
      {(filter === "Tutti" ? genres : [filter]).map((genre) => (
        <section key={genre}>
          <h2>{genre}</h2>
          <div className="ranklist">
            {rows
              .filter((track) => track.genre === genre)
              .map((track, index) => (
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
      ))}
    </>
  );
}
