import { useEffect, useRef, useState } from "react";
import { canPlay } from "../../domain/core.js";
import { fullyPlayed } from "../../hooks/useDailyPlayer.js";

export function useCloudPlayer(round, repository, onComplete, notify) {
  const audioRef = useRef(null);
  const sessionRef = useRef(null);
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const latest = useRef({ round, repository, onComplete, notify });
  latest.current = { round, repository, onComplete, notify };
  const [status, setStatus] = useState({
    active: null,
    playing: false,
    time: 0,
    duration: 0,
    volume: 0.65,
    loading: false,
  });

  function progress(finish = false) {
    const session = sessionRef.current;
    const audio = audioRef.current;
    if (!session || session.failed || session.finished)
      return Promise.resolve();
    const position = audio.currentTime;
    const generation = generationRef.current;
    queueRef.current = queueRef.current
      .then(async () => {
        if (generation !== generationRef.current || session.failed) return;
        await latest.current.repository.progress(session.id, position, finish);
        if (finish && generation === generationRef.current) {
          session.finished = true;
          await latest.current.onComplete();
          latest.current.notify("Ascolto completato e salvato.");
        }
      })
      .catch((error) => {
        if (generation !== generationRef.current) return;
        session.failed = true;
        audio.pause();
        latest.current.notify(error.message);
      })
      .finally(() => {
        if (finish && generation === generationRef.current) {
          busyRef.current = false;
          setStatus((previous) => ({ ...previous, loading: false }));
        }
      });
    return queueRef.current;
  }

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
    const timeupdate = () => {
      update();
      const session = sessionRef.current;
      if (
        session &&
        !audio.paused &&
        !audio.ended &&
        Date.now() - session.lastSent >= 3000
      ) {
        session.lastSent = Date.now();
        void progress();
      }
    };
    const pause = () => {
      update();
      if (!audio.ended) void progress();
    };
    const ended = () => {
      update();
      if (!sessionRef.current || sessionRef.current.failed) return;
      if (!fullyPlayed(audio)) {
        latest.current.notify(
          "Ascolta l’intero brano senza saltare alla fine.",
        );
        return;
      }
      busyRef.current = true;
      setStatus((previous) => ({ ...previous, loading: true }));
      void progress(true);
    };
    const error = () => {
      update();
      latest.current.notify("Audio non disponibile. Riprova.");
    };
    const events = {
      playing: update,
      loadedmetadata: update,
      pause,
      timeupdate,
      ended,
      error,
    };
    Object.entries(events).forEach(([name, handler]) =>
      audio.addEventListener(name, handler),
    );
    return () => {
      generationRef.current++;
      sessionRef.current = null;
      Object.entries(events).forEach(([name, handler]) =>
        audio.removeEventListener(name, handler),
      );
      audio.pause();
    };
  }, []);

  useEffect(() => {
    generationRef.current++;
    sessionRef.current = null;
    busyRef.current = false;
    queueRef.current = Promise.resolve();
    const audio = audioRef.current;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    setStatus((previous) => ({
      ...previous,
      active: null,
      playing: false,
      time: 0,
      duration: 0,
      loading: false,
    }));
  }, [round.day]);

  async function play(id) {
    if (busyRef.current || !canPlay(latest.current.round, id)) return;
    const audio = audioRef.current;
    const current = sessionRef.current;
    if (
      current?.selection === id &&
      !current.failed &&
      !audio.paused &&
      !audio.ended
    ) {
      audio.pause();
      return;
    }
    busyRef.current = true;
    setStatus((previous) => ({ ...previous, loading: true }));
    const generation = generationRef.current;
    try {
      if (
        current?.selection !== id ||
        current.failed ||
        current.finished ||
        audio.ended
      ) {
        // Completa gli aggiornamenti pendenti prima di sostituire la sessione server.
        audio.pause();
        await queueRef.current;
        const session = await latest.current.repository.beginListening(id);
        if (generation !== generationRef.current) return;
        sessionRef.current = {
          id: session.sessionId,
          selection: id,
          lastSent: Date.now(),
        };
        audio.src = session.audioUrl;
        audio.currentTime = 0;
        setStatus((previous) => ({
          ...previous,
          active: id,
          time: 0,
          duration: session.duration,
        }));
      } else await progress();
      if (generation === generationRef.current) await audio.play();
    } catch (error) {
      if (generation === generationRef.current)
        latest.current.notify(error.message || "Riproduzione non riuscita.");
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        setStatus((previous) => ({ ...previous, loading: false }));
      }
    }
  }
  function setVolume(volume) {
    audioRef.current.volume = volume;
    setStatus((previous) => ({ ...previous, volume }));
  }
  return { audioRef, ...status, play, setVolume };
}
