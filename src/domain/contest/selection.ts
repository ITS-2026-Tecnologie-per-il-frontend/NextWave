import type { DemoTrack } from "../../types/models.ts";
import { rng } from "../shared/random.ts";
import { eligibility } from "./contest.ts";
export function selectTracks(
  pool: DemoTrack[],
  preferences: string[],
  seed: string,
  preserved?: string[],
) {
  const random = rng(seed);
  const candidates = pool
    .filter(
      (track) =>
        eligibility(track.listeners) && preferences.includes(track.genre),
    )
    .map((track) => ({
      track,
      weight: -Math.log(Math.max(random(), 1e-9)) * (track.exposures + 1),
    }))
    .sort((a, b) => a.weight - b.weight);
  if (!preserved) return candidates.slice(0, 5).map(({ track }) => track.id);
  const chosen = [...preserved];
  const counts = new Map<string, number>();
  for (const id of chosen) {
    const genre = pool.find((track) => track.id === id)?.genre;
    if (genre) counts.set(genre, (counts.get(genre) || 0) + 1);
  }
  while (chosen.length < 5) {
    const available = candidates.filter(
      ({ track }) => !chosen.includes(track.id),
    );
    available.sort(
      (a, b) =>
        (counts.get(a.track.genre) || 0) - (counts.get(b.track.genre) || 0),
    );
    const next = available[0]?.track;
    if (!next) break;
    chosen.push(next.id);
    counts.set(next.genre, (counts.get(next.genre) || 0) + 1);
  }
  return chosen;
}
