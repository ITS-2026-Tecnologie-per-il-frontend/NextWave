// Verifica l'intero intervallo riprodotto: raggiungere la fine con un seek non basta.
export function fullyPlayed(
  audio: Pick<HTMLAudioElement, "duration" | "ended" | "played">,
) {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !audio.ended)
    return false;
  let end = 0;
  for (let index = 0; index < audio.played.length; index++) {
    if (audio.played.start(index) > end + 0.25) return false;
    end = Math.max(end, audio.played.end(index));
  }
  return end >= audio.duration - 0.25;
}
