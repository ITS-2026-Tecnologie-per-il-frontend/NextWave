import { useCallback, useEffect, useRef, useState } from "react";
import { catalog } from "./data/catalog.js";
import { themes } from "./data/themes.js";
import { canVote, completeTrack, dailyRanking, rome } from "./domain/core.js";
import {
  ensureRound,
  normalizeProfile,
  readProfile,
  STORAGE_KEY,
  writeProfile,
} from "./services/storage.js";
import { useDailyPlayer } from "./hooks/useDailyPlayer.js";
import { useRomeClock } from "./hooks/useRomeClock.js";
import Layout from "./components/Layout.jsx";
import Dialog from "./components/Dialog.jsx";
import Reveal from "./components/Reveal.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Daily from "./pages/Daily.jsx";
import Rankings from "./pages/Rankings.jsx";
import Profile from "./pages/Profile.jsx";
import Artist from "./pages/Artist.jsx";

const routes = ["daily", "ranks", "artist", "profile"];
function currentRoute() {
  const route = location.hash.slice(1);
  return routes.includes(route) ? route : "daily";
}

export default function App() {
  const clock = useRomeClock();
  const [profile, setProfile] = useState(() =>
    ensureRound(readProfile(), rome().day),
  );
  const profileRef = useRef(profile);
  const [route, setRoute] = useState(currentRoute);
  const [dialog, setDialog] = useState(null);
  const [preview, setPreview] = useState(false);
  const [toast, setToast] = useState("");
  const notify = useCallback((message) => setToast(message), []);
  const update = useCallback(
    (transform) => {
      const next = transform(profileRef.current);
      profileRef.current = next;
      setProfile(next);
      try {
        writeProfile(next);
      } catch {
        notify(
          "Salvataggio non disponibile: i progressi dureranno solo in questa sessione.",
        );
      }
    },
    [notify],
  );
  const round = ensureRound(profile, clock.day).rounds[clock.day];
  const onComplete = useCallback(
    (id, day) => {
      if (rome().day !== day) return;
      update((current) => {
        const previous = current.rounds[day];
        if (!previous) return current;
        const completed = completeTrack(previous, id);
        return { ...current, rounds: { ...current.rounds, [day]: completed } };
      });
      notify("Ascolto completato ✓ Il prossimo brano è disponibile.");
    },
    [update, notify],
  );
  const player = useDailyPlayer(round, onComplete, notify);
  const revealed = preview || clock.revealed;

  useEffect(() => {
    update((current) => ensureRound(current, clock.day));
    setPreview(false);
    setDialog(null);
  }, [clock.day, update]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme =
      themes.find((theme) => theme.id === profile.theme)?.id || "pulse";
  }, [profile.theme]);
  useEffect(() => {
    const hashChanged = () => {
      setRoute(currentRoute());
      setDialog(null);
    };
    const storageChanged = (event) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        const next = ensureRound(
          normalizeProfile(JSON.parse(event.newValue)),
          rome().day,
        );
        profileRef.current = next;
        setProfile(next);
      } catch {
        notify("Impossibile leggere i dati aggiornati nell’altra scheda.");
      }
    };
    window.addEventListener("hashchange", hashChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      window.removeEventListener("hashchange", hashChanged);
      window.removeEventListener("storage", storageChanged);
    };
  }, [notify]);
  useEffect(() => {
    if (!profile.onboard || preview || dialog) return;
    const day = Object.keys(profile.rounds)
      .filter((day) => day < clock.day || (day === clock.day && clock.revealed))
      .sort()
      .at(-1);
    if (!day || profile.seenReveals.includes(day)) return;
    setDialog({ type: "reveal", day, preview: false });
    update((current) => ({
      ...current,
      seenReveals: [...new Set([...current.seenReveals, day])],
    }));
  }, [profile, clock.day, clock.revealed, preview, dialog, update]);

  function navigate(next) {
    setDialog(null);
    setRoute(next);
    location.hash = next;
  }
  function patchProfile(values) {
    update((current) => ({ ...current, ...values }));
  }
  function saveTrack(id) {
    update((current) => ({
      ...current,
      saved: current.saved.includes(id)
        ? current.saved.filter((item) => item !== id)
        : [...current.saved, id],
    }));
  }
  function openReveal(isPreview = preview) {
    if (isPreview || rome().revealed)
      setDialog({ type: "reveal", day: clock.day, preview: isPreview });
  }
  function togglePreview() {
    const next = !preview;
    setPreview(next);
    if (next) openReveal(true);
  }
  function confirmVote() {
    const id = dialog?.id;
    const now = rome();
    // Rileggi il voto per ridurre i conflitti tra schede; il backend sarà l'autorità reale.
    const latest = readProfile();
    if (latest.rounds[now.day]?.vote) {
      profileRef.current = ensureRound(latest, now.day);
      setProfile(profileRef.current);
      setDialog(null);
      notify("Hai già votato oggi.");
      return;
    }
    const current = profileRef.current.rounds[now.day];
    if (
      !current ||
      !current.ids.includes(id) ||
      !canVote(current, now.revealed || preview)
    ) {
      setDialog(null);
      notify("Il voto non è più disponibile.");
      return;
    }
    update((profile) => ({
      ...profile,
      rounds: { ...profile.rounds, [now.day]: { ...current, vote: id } },
    }));
    setDialog({ type: "success" });
  }
  return (
    <>
      <audio ref={player.audioRef} preload="metadata" />
      {!profile.onboard ? (
        <Onboarding profile={profile} onFinish={patchProfile} />
      ) : (
        <Layout
          profile={profile}
          route={route}
          navigate={navigate}
          player={{
            ...player,
            track: catalog.find((track) => track.id === player.active),
          }}
          round={round}
          revealed={revealed}
        >
          {route === "daily" && (
            <Daily
              round={round}
              clock={clock}
              revealed={revealed}
              preview={preview}
              player={player}
              saved={profile.saved}
              onVote={(id) => {
                if (canVote(round, revealed)) setDialog({ type: "vote", id });
              }}
              onSave={saveTrack}
              onReveal={() => openReveal()}
              onPreview={togglePreview}
              onRanks={() => navigate("ranks")}
            />
          )}
          {route === "ranks" && (
            <Rankings clock={clock} rounds={profile.rounds} />
          )}
          {route === "profile" && (
            <Profile
              profile={profile}
              onUpdate={patchProfile}
              onSave={saveTrack}
              notify={notify}
            />
          )}
          {route === "artist" && (
            <Artist
              applications={profile.applications}
              onSubmit={(application) => {
                update((current) => ({
                  ...current,
                  applications: [...current.applications, application],
                }));
                notify(
                  "Candidatura demo salvata. Il brano resta in attesa di verifica.",
                );
              }}
            />
          )}
        </Layout>
      )}
      {dialog && (
        <Dialog
          key={dialog.type + (dialog.day || "")}
          reveal={dialog.type === "reveal"}
          onClose={() => setDialog(null)}
        >
          {dialog.type === "reveal" && (
            <Reveal
              round={profile.rounds[dialog.day]}
              rows={dailyRanking(dialog.day, profile.rounds)}
              preview={dialog.preview}
              onClose={() => setDialog(null)}
              onRanks={() => navigate("ranks")}
            />
          )}
          {dialog.type === "vote" && (
            <>
              <span className="eyebrow lime">LA TUA SCELTA CONTA</span>
              <h2>
                Il brano{" "}
                {String(round.ids.indexOf(dialog.id) + 1).padStart(2, "0")} è il
                tuo preferito?
              </h2>
              <p>
                Hai un solo voto al giorno. Una volta confermato, non potrai
                cambiarlo.
              </p>
              <div className="actions">
                <button
                  className="btn secondary"
                  onClick={() => setDialog(null)}
                >
                  Ci ripenso
                </button>
                <button className="btn" onClick={confirmVote}>
                  Conferma voto
                </button>
              </div>
            </>
          )}
          {dialog.type === "success" && (
            <>
              <span className="eyebrow lime">VOTO REGISTRATO</span>
              <h2>Hai dato voce a una nuova scoperta.</h2>
              <p>Torna alle 21:00 per scoprire tutti gli artisti.</p>
              <button className="btn" onClick={() => setDialog(null)}>
                Torna al pulse
              </button>
            </>
          )}
        </Dialog>
      )}
      <div
        id="toast"
        role="status"
        style={{ display: toast ? "block" : "none" }}
      >
        {toast}
      </div>
    </>
  );
}
