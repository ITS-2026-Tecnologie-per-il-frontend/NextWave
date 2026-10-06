import type { Clock, RankingPeriod } from "../types/models.ts";
export function score(votes: number, exposures: number) {
  return exposures > 0 ? votes / exposures : 0;
}

export function rankingDate(clock: Clock, period: RankingPeriod) {
  const date = new Date(`${clock.day}T12:00:00Z`);
  if (period === "day" && !clock.revealed)
    date.setUTCDate(date.getUTCDate() - 1);
  if (period === "week") {
    const weekday = date.getUTCDay();
    date.setUTCDate(
      date.getUTCDate() - (weekday === 0 ? (clock.revealed ? 0 : 7) : weekday),
    );
  }
  return date.toISOString().slice(0, 10);
}
