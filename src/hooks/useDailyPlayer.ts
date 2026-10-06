import type { Round, Notify, PlayerStatus } from "../types/models.ts";
import { useEffect, useRef, useState } from "react";
import { canPlay } from "../domain/contest.ts";

import { fullyPlayed } from "../domain/playback.ts";

export function useDailyPlayer(
  round: Round,
  onComplete: (id: string, day: string) => void,
  notify: Notify,
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const sessionRef = useRef<{ id: string; day: string } | null>(null);
  const latest = useRef({ round, onComplete, notify });
  latest.current = { round, onComplete, notify };
  const [status, setStatus] = useState<PlayerStatus>({
    active: null,
    playing: false,
    time: 0,
    duration: 0,
    volume: 0.65,
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.65;
    const update = () =>
      setStatus((previous) => ({
        ...previous,
        playing: !audio.paused && !audio.ended,
        time: audio.currentTime || 0,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }));
    const ended = () => {
      update();
      const session = sessionRef.current;
      if (
        session &&
        session.day === latest.current.round.day &&
        fullyPlayed(audio)
      ) {
        latest.current.onComplete(session.id, session.day);
      }
    };
    const error = () => {
      update();
      if (sessionRef.current)
        latest.current.notify("Impossibile caricare l’audio demo. Riprova.");
    };
    const events = {
      playing: update,
      pause: update,
      timeupdate: update,
      loadedmetadata: update,
      ended,
      error,
    };
    Object.entries(events).forEach(([name, handler]) =>
      audio.addEventListener(name, handler),
    );
    return () => {
      sessionRef.current = null;
      Object.entries(events).forEach(([name, handler]) =>
        audio.removeEventListener(name, handler),
      );
      audio.pause();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    sessionRef.current = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    setStatus((previous) => ({
      ...previous,
      active: null,
      playing: false,
      time: 0,
      duration: 0,
    }));
  }, [round.day]);

  async function play(id: string) {
    const currentRound = latest.current.round;
    if (!canPlay(currentRound, id)) {
      latest.current.notify(
        "Completa il brano precedente prima di passare al successivo.",
      );
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    const session = sessionRef.current;
    if (session?.id === id && !audio.paused && !audio.ended) {
      audio.pause();
      return;
    }
    if (session?.id !== id || session.day !== currentRound.day) {
      audio.pause();
      sessionRef.current = { id, day: currentRound.day };
      audio.src = `/audio/${currentRound.ids.indexOf(id)}.wav`;
      setStatus((previous) => ({
        ...previous,
        active: id,
        time: 0,
        duration: 0,
        playing: false,
      }));
    } else if (audio.ended) audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      if (sessionRef.current?.id === id)
        latest.current.notify("Audio non disponibile. Riprova a premere play.");
    }
  }
  function setVolume(volume: number) {
    if (audioRef.current) audioRef.current.volume = volume;
    setStatus((previous) => ({ ...previous, volume }));
  }
  return { audioRef, ...status, play, setVolume };
}
