import { useEffect, useRef, type CSSProperties } from "react";
import { usePlayback } from "../../hooks/usePlayback.ts";
import { Icon } from "../ui/Icon.tsx";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function PlayerBar() {
  const {
    player,
    round,
    revealed,
    cloud,
    saved = false,
    saving = false,
    onSave,
  } = usePlayback();
  const audibleVolume = useRef(1);
  useEffect(() => {
    if (player.volume > 0) audibleVolume.current = player.volume;
  }, [player.volume]);
  function toggleMute() {
    if (player.volume > 0) {
      audibleVolume.current = player.volume;
      player.setVolume(0);
    } else player.setVolume(audibleVolume.current);
  }
  const canSave = Boolean(
    player.active &&
    onSave &&
    (revealed || round.listened.includes(player.active)),
  );
  const trackIndex = player.active ? round.ids.indexOf(player.active) : -1;
  return (
    <section className="player" aria-label="Player musicale">
      <div className="player-track">
        <div
          className={`player-signal ${player.playing ? "active" : ""}`}
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
          <i />
        </div>

        <div className="playerinfo">
          {player.active ? (
            <>
              <strong>
                {revealed
                  ? player.track?.title
                  : `Brano ${String(trackIndex + 1).padStart(2, "0")}`}
              </strong>
              <span>
                {`${player.track?.genre} · ${!cloud || player.track?.isDemo ? "Audio demo" : "Audio"}`}
              </span>
            </>
          ) : (
            <>
              <strong>Scegli un brano</strong>
              <span>La tua prossima scoperta</span>
            </>
          )}
        </div>
      </div>
      <div className="player-controls">
        <div className="player-actions">
          <button
            className="player-rewind"
            type="button"
            disabled={!player.active || player.loading}
            onClick={() => player.rewind()}
            aria-label="Torna indietro di 10 secondi"
            title="Indietro di 10 secondi"
          >
            <span aria-hidden="true">↶</span>
            <b aria-hidden="true">10s</b>
          </button>
          <button
            className="player-toggle"
            disabled={
              !round.ids.length || player.loading || (cloud && revealed)
            }
            onClick={() => player.play(player.active || round.ids[0])}
            aria-label={player.playing ? "Pausa" : "Riproduci"}
          >
            <Icon name={player.playing ? "pause" : "play"} />
          </button>
          <button
            type="button"
            className={`player-save ${saved ? "chosen" : ""}`}
            disabled={!canSave || saving}
            aria-label={
              saved
                ? "Rimuovi il brano dai preferiti"
                : "Salva il brano nei preferiti"
            }
            aria-pressed={saved}
            title={
              canSave
                ? saved
                  ? "Rimuovi dai preferiti"
                  : "Salva nei preferiti"
                : "Completa l’ascolto per salvare"
            }
            onClick={() => {
              if (player.active) onSave?.(player.active);
            }}
          >
            <Icon name="heart" />
          </button>
        </div>
        <div className="player-progress-wrap">
          <div className="player-time">
            <span>{formatTime(player.time)}</span>
            <span>
              {player.duration > 0
                ? `-${formatTime(Math.max(0, player.duration - player.time))}`
                : "0:00"}
            </span>
          </div>
          <progress
            value={player.time}
            max={player.duration || 1}
            aria-label="Avanzamento brano"
          />
        </div>
      </div>
      <div className="volume">
        <button
          type="button"
          className="volume-toggle"
          onClick={toggleMute}
          aria-label={
            player.volume === 0 ? "Riattiva audio" : "Disattiva audio"
          }
          aria-pressed={player.volume === 0}
          title={player.volume === 0 ? "Riattiva audio" : "Disattiva audio"}
        >
          <span className="volume-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              className={`volume-icon-svg ${player.volume === 0 ? "muted" : ""}`}
            >
              {player.volume === 0 && (
                <path d="m15 9 6 6m0-6-6 6" className="volume-muted" />
              )}
              <path
                className="volume-speaker"
                d="M4 10v4h3l4 3V7l-4 3H4z"
                fill="currentColor"
              />
              <path
                className={
                  player.volume >= 0.2 ? "volume-wave active" : "volume-wave"
                }
                d="M15 9.5a4 4 0 0 1 0 5"
              />
              <path
                className={
                  player.volume >= 0.5 ? "volume-wave active" : "volume-wave"
                }
                d="M17.5 7a7.5 7.5 0 0 1 0 10"
              />
              <path
                className={
                  player.volume >= 0.8 ? "volume-wave active" : "volume-wave"
                }
                d="M20 4.8a11 11 0 0 1 0 14.4"
              />
            </svg>
          </span>
        </button>
        <input
          type="range"
          style={{ "--volume": `${player.volume * 100}%` } as CSSProperties}
          min="0"
          max="1"
          step="0.05"
          value={player.volume}
          onChange={(event) => player.setVolume(Number(event.target.value))}
          aria-label="Volume"
          aria-valuetext={`${Math.round(player.volume * 100)}%`}
        />
      </div>
    </section>
  );
}
