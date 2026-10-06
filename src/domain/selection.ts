import type { DemoTrack } from "../types/models.ts";
import { rng } from "./random.ts";
import { eligibility } from "./contest.ts";
export function selectTracks(
  pool: DemoTrack[],
  preferences: string[],
  seed: string,
) {
  const random = rng(seed);
  return pool
    .filter(
      (track) =>
        eligibility(track.listeners) && preferences.includes(track.genre),
    )
    .map((track) => ({
      track,
      weight: -Math.log(Math.max(random(), 1e-9)) * (track.exposures + 1),
    }))
    .sort((a, b) => a.weight - b.weight)
    .slice(0, 5)
    .map(({ track }) => track.id);
}
