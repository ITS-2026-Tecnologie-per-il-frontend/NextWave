import type { Round, RankingRow } from "../types/models.ts";
export default function Reveal({
  round,
  rows,
  preview,
  onClose,
  onRanks,
}: {
  round: Round;
  rows: RankingRow[];
  preview: boolean;
  onClose: () => void;
  onRanks: () => void;
}) {
  const selected = rows.filter((track) => round.ids.includes(track.id));
  return (
    <>
      <button
        className="reveal-close"
        onClick={onClose}
        aria-label="Chiudi la classifica"
      >
        ×
      </button>
      <span className="eyebrow lime">
        {preview ? "REVEAL DI PROVA" : "CONTEST CONCLUSO"} ·{" "}
        {round.day.split("-").reverse().join("/")}
      </span>
      <h2>
        Hai ascoltato le voci.
        <br />
        <span className="lime">Ora scopri i nomi.</span>
      </h2>
      <p className="reveal-intro">
        La classifica dei tuoi 5 brani. Ogni artista merita il suo spazio.
      </p>
      <ol className="reveal-list">
        {selected.map((track, index) => (
          <li
            key={track.id}
            className={`reveal-row ${index === 0 ? "reveal-winner" : ""}`}
          >
            <span className="reveal-position">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="reveal-track">
              {index === 0 && (
                <span className="reveal-label">PRIMO NELLA TUA SELEZIONE</span>
              )}
              <strong>{track.title}</strong>
              <span>
                {track.artist} · {track.genre}
              </span>
              {round.vote === track.id && (
                <span className="reveal-voted">♥ Il tuo voto</span>
              )}
            </div>
            <div className="reveal-score">
              <strong>
                {(track.score * 100).toFixed(1).replace(".", ",")}
                <small>%</small>
              </strong>
              <span>{track.votes} voti</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="hint">
        Risultati demo · Punteggio: voti ÷ esposizioni × 100.
      </p>
      <div className="actions">
        <button className="btn" onClick={onClose}>
          Continua a esplorare →
        </button>
        <button className="btn secondary" onClick={onRanks}>
          Apri classifiche
        </button>
      </div>
    </>
  );
}
