import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "../../services/supabase.js";
import { createCloudRepository } from "../../services/cloudRepository.js";
import { canVote, rome } from "../../domain/core.js";
import Auth, { useAuth } from "./Auth.jsx";
import { useCloudPlayer } from "./useCloudPlayer.js";
import CloudRankings from "./CloudRankings.jsx";
import Layout from "../../components/Layout.jsx";
import Dialog from "../../components/Dialog.jsx";
import Reveal from "../../components/Reveal.jsx";
import Onboarding from "../../pages/Onboarding.jsx";
import Daily from "../../pages/Daily.jsx";
import Profile from "../../pages/Profile.jsx";
import Artist from "../../pages/Artist.jsx";

const readRoute = () =>
  ["daily", "ranks", "profile", "artist"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "daily";

export default function CloudApp() {
  const [client] = useState(getSupabase);
  const [repository] = useState(() => createCloudRepository(client));
  const { session, loading, error } = useAuth(client);
  if (loading)
    return (
      <main className="connection-page">
        <p role="status">Verifica dell’accesso…</p>
      </main>
    );
  if (error)
    return (
      <main className="connection-page">
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Riprova</button>
      </main>
    );
  return session ? (
    <Account key={session.user.id} client={client} repository={repository} />
  ) : (
    <Auth client={client} />
  );
}

export function Account({ client, repository }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState(readRoute);
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);
  const alive = useRef(true);
  const requestRef = useRef(0);
  const dataRef = useRef(null);
  const mutationRef = useRef(false);
  const revealPending = useRef(false);
  const notify = useCallback((message) => setToast(message), []);
  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    const result = await repository.dashboard();
    if (!alive.current || request !== requestRef.current) return;
    if (!dataRef.current) {
      dayRef.current = result.clock.day;
      revealRef.current = result.clock.revealed;
    }
    offsetRef.current = Date.parse(result.serverTime) - Date.now();
    dataRef.current = result;
    setData(result);
    setNow(Date.now());
    setError("");
    return result;
  }, [repository]);
  useEffect(() => {
    alive.current = true;
    refresh().catch((error) => {
      if (alive.current) setError(error.message);
    });
    const poll = setInterval(() => {
      refresh().catch((error) => {
        if (alive.current) setError(error.message);
      });
    }, 30000);
    const focus = () => {
      refresh().catch((error) => {
        if (alive.current) setError(error.message);
      });
    };
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      requestRef.current++;
      clearInterval(poll);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const changed = () => {
      setRoute(readRoute());
      setDialog(null);
    };
    window.addEventListener("hashchange", changed);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", changed);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const clock = rome(new Date(now + offsetRef.current));
  const dayRef = useRef(clock.day);
  const revealRef = useRef(clock.revealed);
  useEffect(() => {
    if (dayRef.current !== clock.day || revealRef.current !== clock.revealed) {
      dayRef.current = clock.day;
      revealRef.current = clock.revealed;
      setDialog(null);
      refresh().catch((error) => notify(error.message));
    }
  }, [clock.day, clock.revealed, refresh, notify]);
  const profile = data?.profile;
  const round = profile?.rounds[clock.day] || {
    day: clock.day,
    ids: [],
    listened: [],
    vote: null,
  };
  const player = useCloudPlayer(round, repository, refresh, notify);
  useEffect(() => {
    if (profile) document.documentElement.dataset.theme = profile.theme;
  }, [profile?.theme]);

  const showReveal = useCallback(
    async (day) => {
      if (revealPending.current) return;
      revealPending.current = true;
      try {
        const rows = await repository.reveal(day);
        if (!alive.current) return;
        setDialog({ type: "reveal", day, rows });
        await repository.seenReveal(day);
        await refresh();
      } catch (error) {
        if (alive.current) notify(error.message);
      } finally {
        revealPending.current = false;
      }
    },
    [repository, refresh, notify],
  );
  useEffect(() => {
    if (!profile?.onboard || dialog || revealPending.current) return;
    const day = Object.keys(profile.rounds)
      .filter((day) => day < clock.day || (day === clock.day && clock.revealed))
      .sort()
      .at(-1);
    if (day && !profile.seenReveals.includes(day)) void showReveal(day);
  }, [profile, clock.day, clock.revealed, dialog, showReveal]);

  async function mutate(action, message) {
    if (mutationRef.current)
      throw new Error("Attendi il salvataggio in corso.");
    mutationRef.current = true;
    setBusy(true);
    try {
      await action();
      await refresh();
      if (message) notify(message);
    } finally {
      mutationRef.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function patchProfile(values) {
    return mutate(() =>
      repository.saveProfile({ ...dataRef.current.profile, ...values }),
    );
  }
  function handled(promise) {
    promise.catch((error) => notify(error.message));
  }
  function navigate(next) {
    setRoute(next);
    setDialog(null);
    location.hash = next;
  }
  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) notify(error.message);
  }
  async function confirmVote() {
    try {
      await mutate(
        () => repository.vote(dialog.id),
        "Voto salvato. Torna alle 21:00 per il reveal.",
      );
      setDialog(null);
    } catch (error) {
      notify(error.message);
      setDialog(null);
    }
  }

  if (!data)
    return (
      <>
        <audio ref={player.audioRef} />
        <main className="connection-page">
          <section className="panel">
            {error ? (
              <>
                <p role="alert">{error}</p>
                <button className="btn" onClick={() => handled(refresh())}>
                  Riprova
                </button>
                <button className="textbtn" onClick={signOut}>
                  Esci dall’account
                </button>
              </>
            ) : (
              <p role="status">Caricamento dei tuoi dati…</p>
            )}
          </section>
        </main>
      </>
    );
  const tracks = data.tracks;
  const currentTrack = tracks.find((track) => track.id === player.active);
  return (
    <>
      <audio ref={player.audioRef} preload="metadata" />
      {!profile.onboard ? (
        <Onboarding
          profile={profile}
          cloud
          busy={busy}
          onFinish={(values) => handled(patchProfile(values))}
        />
      ) : (
        <Layout
          cloud
          profile={profile}
          route={route}
          navigate={navigate}
          player={{ ...player, track: currentTrack }}
          round={round}
          revealed={clock.revealed}
        >
          {error && (
            <p className="error connection-error" role="alert">
              {error} I progressi non confermati dal server non vengono salvati.
            </p>
          )}
          {route === "daily" &&
            (round.ids.length === 5 ? (
              <Daily
                cloud
                tracks={tracks}
                round={round}
                clock={clock}
                revealed={clock.revealed}
                preview={false}
                player={player}
                saved={profile.saved}
                onVote={(id) => {
                  if (!busy && canVote(round, clock.revealed))
                    setDialog({ type: "vote", id });
                }}
                onSave={(id) => handled(mutate(() => repository.favorite(id)))}
                onReveal={() => void showReveal(clock.day)}
                onRanks={() => navigate("ranks")}
              />
            ) : (
              <section className="panel">
                <h1>Stiamo preparando il tuo pulse.</h1>
                <p>
                  Non ci sono ancora cinque brani approvati nei generi che hai
                  scelto. I progressi appariranno qui quando il catalogo sarà
                  pronto.
                </p>
                <button
                  className="btn secondary"
                  onClick={() => navigate("profile")}
                >
                  Modifica i tuoi gusti
                </button>
              </section>
            ))}
          {route === "profile" && (
            <Profile
              cloud
              busy={busy}
              profile={profile}
              tracks={data.favorites}
              onUpdate={(values) => {
                const promise = patchProfile(values);
                // Gli aggiornamenti del form gestiscono il proprio errore; i pulsanti richiedono feedback.
                if (!values.prefs) handled(promise);
                return promise;
              }}
              onSave={(id) =>
                handled(mutate(() => repository.favorite(id, true)))
              }
              notify={notify}
              onSignOut={signOut}
            />
          )}
          {route === "artist" && (
            <Artist
              cloud
              applications={profile.applications}
              onSubmit={(application) =>
                mutate(
                  () => repository.submitApplication(application),
                  "Candidatura salvata, in attesa di verifica.",
                )
              }
            />
          )}
          {route === "ranks" && <CloudRankings repository={repository} />}
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
              rows={dialog.rows}
              preview={false}
              onClose={() => setDialog(null)}
              onRanks={() => navigate("ranks")}
            />
          )}
          {dialog.type === "vote" && (
            <>
              <h2>
                Confermi il voto per il brano {round.ids.indexOf(dialog.id) + 1}
                ?
              </h2>
              <p>Hai un solo voto al giorno e non potrai cambiarlo.</p>
              <div className="actions">
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  Ci ripenso
                </button>
                <button className="btn" disabled={busy} onClick={confirmVote}>
                  Conferma voto
                </button>
              </div>
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
