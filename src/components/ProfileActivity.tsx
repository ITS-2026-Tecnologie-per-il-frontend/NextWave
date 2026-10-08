import { useState } from "react";
import type { Clock, Profile, Track } from "../types/models.ts";
import Dialog from "./Dialog.tsx";
import { SpotifyLink } from "./ui/SpotifyLink.tsx";
import { Icon } from "./ui/Icon.tsx";

type Activity = "votes" | "completed" | "saved";
type Entry = { id: string; day?: string; slot?: number; track?: Track };
const labels: Record<Activity, string> = {
  votes: "Voti espressi",
  completed: "Brani completati",
  saved: "Scoperte salvate",
};

export function ProfileActivity({
  profile,
  tracks,
  favorites,
  clock,
  cloud = false,
  busy = false,
  onSave,
}: {
  profile: Profile;
  tracks: Track[];
  favorites: Track[];
  clock: Clock;
  cloud?: boolean;
  busy?: boolean;
  onSave: (id: string) => void;
}) {
  const [opened, setOpened] = useState<Activity | null>(null);
  const rounds = Object.values(profile.rounds).sort((a, b) =>
    b.day.localeCompare(a.day),
  );
  const entry = (id: string, day: string, ids: string[]): Entry => ({
    id,
    day,
    slot: ids.indexOf(id) + 1,
    track: tracks.find((track) => track.id === id),
  });
  const entries: Record<Activity, Entry[]> = {
    votes: rounds.flatMap((round) =>
      round.vote ? [entry(round.vote, round.day, round.ids)] : [],
    ),
    completed: rounds.flatMap((round) =>
      round.listened.map((id) => entry(id, round.day, round.ids)),
    ),
    saved: profile.saved.map((id) => {
      const track = favorites.find((item) => item.id === id);
      const round = rounds.find((item) => item.ids.includes(id));
      return {
        id,
        track,
        day: track?.day ?? round?.day,
        slot: track?.slot ?? (round ? round.ids.indexOf(id) + 1 : undefined),
      };
    }),
  };
  return (
    <>
      <div className="statgrid">
        {(Object.keys(labels) as Activity[]).map((key) => (
          <button
            className="panel activity-stat"
            key={key}
            onClick={() => setOpened(key)}
            aria-label={`Esplora ${labels[key].toLowerCase()}: ${entries[key].length}`}
            aria-haspopup="dialog"
          >
            <strong>{entries[key].length}</strong>
            <small>{labels[key]}</small>
            <span className="activity-open">Esplora ↗</span>
          </button>
        ))}
      </div>
      {opened && (
        <Dialog
          onClose={() => setOpened(null)}
          className="activity-dialog"
          ariaLabel={labels[opened]}
        >
          <header className="activity-heading">
            <div>
              <span className="eyebrow">IL TUO PERCORSO</span>
              <h2>{labels[opened]}</h2>
            </div>
            <button
              className="dialog-close"
              aria-label="Chiudi attività"
              onClick={() => setOpened(null)}
            >
              ✕
            </button>
          </header>
          <p className="hint">
            Artista, titolo e link si svelano solo dopo il reveal del contest.
          </p>
          {!entries[opened].length && (
            <p className="activity-empty">
              {opened === "saved"
                ? "Non hai ancora salvato brani. Tocca il cuore durante l’ascolto."
                : opened === "votes"
                  ? "Non hai ancora espresso voti."
                  : "Non hai ancora completato ascolti."}
            </p>
          )}
          <div className="activity-list">
            {entries[opened].map((item) => {
              const dateRevealed = Boolean(
                item.day &&
                (item.day < clock.day ||
                  (item.day === clock.day && clock.revealed)),
              );
              const revealed = cloud
                ? item.track?.revealed === true ||
                  (item.track?.revealed === undefined &&
                    dateRevealed &&
                    Boolean(item.track?.title && item.track?.artist))
                : dateRevealed;
              return (
                <article
                  className="panel activity-entry"
                  key={`${item.day ?? "saved"}:${item.id}`}
                >
                  <span className="activity-symbol" aria-hidden="true">
                    <Icon
                      name={
                        opened === "saved"
                          ? "heart"
                          : opened === "votes"
                            ? "ranks"
                            : "play"
                      }
                    />
                  </span>
                  <div className="activity-copy">
                    <small>
                      {item.day
                        ? `Contest del ${item.day.split("-").reverse().join("/")}`
                        : "La tua raccolta"}
                    </small>
                    <h3>
                      {revealed
                        ? (item.track?.title ?? "Brano non disponibile")
                        : item.slot
                          ? `Brano ${String(item.slot).padStart(2, "0")}`
                          : "Brano anonimo"}
                    </h3>
                    <p className="hint">
                      {revealed
                        ? (item.track?.artist ?? "")
                        : "Identità nascosta fino al reveal"}
                    </p>
                    {revealed && item.track && (
                      <SpotifyLink track={item.track} />
                    )}
                  </div>
                  {opened === "saved" && (
                    <button
                      className="favorite-toggle selected"
                      disabled={busy}
                      onClick={() => onSave(item.id)}
                      aria-label={`Rimuovi dai preferiti: ${revealed ? (item.track?.title ?? "brano") : "brano anonimo"}`}
                    >
                      <Icon name="heart" />
                      <span>Rimuovi</span>
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </Dialog>
      )}
    </>
  );
}
