import { useEffect, useRef, useState } from "react";
import { canPlay } from "../domain/core.js";

// Verifica l'intero intervallo riprodotto: raggiungere la fine con un seek non basta.
export function fullyPlayed(audio) {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !audio.ended)
    return false;
  let end = 0;
  for (let index = 0; index < audio.played.length; index++) {
    if (audio.played.start(index) > end + 0.25) return false;
    end = Math.max(end, audio.played.end(index));
  }
  return end >= audio.duration - 0.25;
}

export function useDailyPlayer(round, onComplete, notify) {
  const audioRef = useRef(null);
  const sessionRef = useRef(null);
  const latest = useRef({ round, onComplete, notify });
  latest.current = { round, onComplete, notify };
  const [status, setStatus] = useState({
    active: null,
    playing: false,
    time: 0,
    duration: 0,
    volume: 0.65,
  });

  useEffect(() => {
    const audio = audioRef.current;
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

  async function play(id) {
    const currentRound = latest.current.round;
    if (!canPlay(currentRound, id)) {
      latest.current.notify(
        "Completa il brano precedente prima di passare al successivo.",
      );
      return;
    }
    const audio = audioRef.current;
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
  function setVolume(volume) {
    audioRef.current.volume = volume;
    setStatus((previous) => ({ ...previous, volume }));
  }
  return { audioRef, ...status, play, setVolume };
}
