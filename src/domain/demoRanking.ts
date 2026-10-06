import type {
  DemoTrack,
  RankingPeriod,
  RankingRow,
  Round,
} from "../types/models.ts";
import { catalog } from "../data/demo/catalog.ts";
import { rng } from "./random.ts";
import { score } from "./ranking.ts";
export function rankRows(
  pool: DemoTrack[],
  period: RankingPeriod,
  day: string,
): RankingRow[] {
  return pool
    .map((track) => {
      const random = rng(track.id + day + period);
      let exposures = 0,
        votes = 0;
      for (let index = 0; index < (period === "week" ? 7 : 1); index++) {
        const count = 100 + Math.floor(random() * 500);
        exposures += count;
        votes += Math.floor(count * (0.07 + random() * 0.3));
      }
      return { ...track, exposures, votes, score: score(votes, exposures) };
    })
    .sort((a, b) => b.score - a.score || b.exposures - a.exposures);
}

export function dailyRanking(
  day: string,
  rounds: Record<string, Round>,
): RankingRow[] {
  const round = rounds[day];
  return rankRows(catalog, "day", day)
    .map((track) => {
      const exposures =
        track.exposures + (round?.ids.includes(track.id) ? 1 : 0);
      const votes = track.votes + (round?.vote === track.id ? 1 : 0);
      return { ...track, exposures, votes, score: score(votes, exposures) };
    })
    .sort((a, b) => b.score - a.score || b.exposures - a.exposures);
}
