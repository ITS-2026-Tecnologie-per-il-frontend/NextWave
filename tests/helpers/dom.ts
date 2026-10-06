export function getAudio(): HTMLAudioElement {
  const audio = document.querySelector("audio");
  if (!audio) throw new Error("Il test richiede un player audio montato.");
  return audio;
}
