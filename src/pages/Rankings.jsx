import { useState } from "react";
import { catalog, genres } from "../data/catalog.js";
import { dailyRanking, rankRows, rankingDate } from "../domain/core.js";
import { Heading } from "../components/ui.jsx";
export default function Rankings({ clock, rounds }) {
  const [period, setPeriod] = useState("day");
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
        {[
          ["day", "Giornaliera"],
          ["week", "Settimanale"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={period === value ? "active" : ""}
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
      ))}
    </>
  );
}
