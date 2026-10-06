import { getErrorMessage } from "../domain/errors.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudRepository } from "../services/cloudRepository.ts";
import type {
  Dashboard,
  CloudDialog,
  ProfileChanges,
  Route,
} from "../types/models.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { canVote } from "../domain/contest.ts";
import { rome } from "../domain/time.ts";
import { useCloudPlayer } from "../hooks/useCloudPlayer.ts";
import CloudRankings from "../pages/CloudRankings.tsx";
import Layout from "../components/Layout.tsx";
import Dialog from "../components/Dialog.tsx";
import Reveal from "../components/Reveal.tsx";
import Onboarding from "../pages/Onboarding.tsx";
import Daily from "../pages/Daily.tsx";
import Profile from "../pages/Profile.tsx";
import Artist from "../pages/Artist.tsx";
import Admin from "../pages/Admin.tsx";

import { readRoute } from "../config/routes.ts";

export function Account({
  client,
  repository,
}: {
  client: SupabaseClient;
  repository: CloudRepository;
}) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState(() => readRoute(location.hash, true));
  const [dialog, setDialog] = useState<CloudDialog | null>(null);
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0);
  const alive = useRef(true);
  const requestRef = useRef(0);
  const dataRef = useRef<Dashboard | null>(null);
  const mutationRef = useRef(false);
  const revealPending = useRef(false);
  const notify = useCallback((message: string) => setToast(message), []);
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
      if (alive.current) setError(getErrorMessage(error));
    });
    const poll = setInterval(() => {
      refresh().catch((error) => {
        if (alive.current) setError(getErrorMessage(error));
      });
    }, 30000);
    const focus = () => {
      refresh().catch((error) => {
        if (alive.current) setError(getErrorMessage(error));
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
      setRoute(readRoute(location.hash, true));
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
      refresh().catch((error) => notify(getErrorMessage(error)));
    }
  }, [clock.day, clock.revealed, refresh, notify]);
  const profile = data?.profile;
  const canAdmin = data?.adminAccess?.allowed === true;
  useEffect(() => {
    if (data && route === "admin" && !canAdmin) {
      setRoute("daily");
      location.hash = "daily";
    }
  }, [data, route, canAdmin]);
  const round = profile?.rounds[clock.day] || {
    day: clock.day,
    ids: [],
    listened: [],
    vote: null,
  };
  const player = useCloudPlayer(round, repository, refresh, notify);
  useEffect(() => {
    if (clock.revealed) player.audioRef.current?.pause();
  }, [clock.revealed, player.audioRef]);
  useEffect(() => {
    if (profile) document.documentElement.dataset.theme = profile.theme;
  }, [profile?.theme]);

  const showReveal = useCallback(
    async (day: string) => {
      if (revealPending.current) return;
      revealPending.current = true;
      try {
        const rows = await repository.reveal(day);
        if (!alive.current) return;
        setDialog({ type: "reveal", day, rows });
        await repository.seenReveal(day);
        await refresh();
      } catch (error) {
        if (alive.current) notify(getErrorMessage(error));
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

  async function mutate(action: () => Promise<unknown>, message?: string) {
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
  function patchProfile(values: ProfileChanges) {
    const currentProfile = dataRef.current?.profile;
    if (!currentProfile)
      return Promise.reject(new Error("Profilo non ancora disponibile."));
    return mutate(() =>
      repository.saveProfile({ ...currentProfile, ...values }),
    );
  }
  function handled(promise: Promise<unknown>) {
    promise.catch((error) => notify(getErrorMessage(error)));
  }
  function navigate(next: Route) {
    setRoute(next);
    setDialog(null);
    location.hash = next;
  }
  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) notify(getErrorMessage(error));
  }
  async function confirmVote() {
    if (dialog?.type !== "vote") return;
    const selectionId = dialog.id;
    try {
      await mutate(
        () => repository.vote(selectionId),
        "Voto salvato. Torna alle 21:00 per il reveal.",
      );
      setDialog(null);
    } catch (error) {
      notify(getErrorMessage(error));
      setDialog(null);
    }
  }

  if (!data || !profile)
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
          admin={canAdmin}
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
                <h1>Stiamo preparando la tua selezione.</h1>
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
              onSubmit={(application, audio) =>
                mutate(
                  () => repository.submitApplication(application, audio),
                  "Candidatura salvata, in attesa di verifica.",
                )
              }
            />
          )}
          {route === "ranks" && <CloudRankings repository={repository} />}
          {route === "admin" && canAdmin && (
            <Admin
              repository={repository}
              onAccessLost={() => {
                void refresh();
                navigate("daily");
              }}
            />
          )}
        </Layout>
      )}
      {dialog && (
        <Dialog
          key={dialog.type + ("day" in dialog ? dialog.day : "")}
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
