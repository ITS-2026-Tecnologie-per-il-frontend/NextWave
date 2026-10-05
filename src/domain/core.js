import { catalog } from "../data/catalog.js";
export { catalog, genres } from "../data/catalog.js";

export function rome(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    seconds:
      Number(parts.hour) * 3600 +
      Number(parts.minute) * 60 +
      Number(parts.second),
    revealed: Number(parts.hour) >= 21,
  };
}

export function rng(seed) {
  let state = 2166136261;
  for (const character of seed)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectTracks(pool, preferences, seed) {
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

export function score(votes, exposures) {
  return exposures > 0 ? votes / exposures : 0;
}
export function eligibility(listeners) {
  return Number.isInteger(listeners) && listeners >= 0 && listeners < 10000;
}
export function canPlay(round, id) {
  const index = round.ids.indexOf(id);
  return (
    index >= 0 &&
    round.ids
      .slice(0, index)
      .every((previous) => round.listened.includes(previous))
  );
}
export function completeTrack(round, id) {
  if (!canPlay(round, id) || round.listened.includes(id)) return round;
  return { ...round, listened: [...round.listened, id] };
}
export function canVote(round, revealed) {
  return (
    !revealed &&
    !round.vote &&
    round.ids.length === 5 &&
    round.ids.every((id) => round.listened.includes(id))
  );
}
export function rankRows(pool, period, day) {
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
export function dailyRanking(day, rounds) {
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
export function rankingDate(clock, period) {
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
