import type { Round } from "../types/models.ts";
export function eligibility(listeners: number) {
  return Number.isInteger(listeners) && listeners >= 0 && listeners < 10000;
}

export function canPlay(round: Round, id: string) {
  const index = round.ids.indexOf(id);
  return (
    index >= 0 &&
    round.ids
      .slice(0, index)
      .every((previous) => round.listened.includes(previous))
  );
}

export function completeTrack(round: Round, id: string) {
  if (!canPlay(round, id) || round.listened.includes(id)) return round;
  return { ...round, listened: [...round.listened, id] };
}

export function canVote(round: Round, revealed: boolean) {
  return (
    !revealed &&
    !round.vote &&
    round.ids.length === 5 &&
    round.ids.every((id) => round.listened.includes(id))
  );
}
