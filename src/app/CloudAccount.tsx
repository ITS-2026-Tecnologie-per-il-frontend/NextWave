import { getErrorMessage } from "../domain/shared/errors.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudRepository } from "../services/cloud/cloudRepository.ts";
import type { CloudDialog, Route } from "../types/models.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { canVote } from "../domain/contest/contest.ts";
import { useAccount } from "../hooks/useAccount.ts";
import { AccountProvider } from "../context/account/AccountProvider.tsx";
import { PlaybackContext } from "../context/playback/PlaybackContext.ts";
import { useCloudPlayer } from "../hooks/useCloudPlayer.ts";
import CloudRankings from "../screens/rankings/CloudRankings.tsx";
import Layout from "../components/layout/Layout.tsx";
import Dialog from "../components/dialogs/Dialog.tsx";
import Reveal from "../components/contest/Reveal.tsx";
import Onboarding from "../screens/auth/Onboarding.tsx";
import Daily from "../screens/contest/Daily.tsx";
import Profile from "../screens/account/Profile.tsx";
import Artist from "../screens/artist/Artist.tsx";
import Admin from "../screens/admin/Admin.tsx";

import { routePaths, routeForPath } from "../config/routes.ts";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AccountRoutes } from "./routing/AccountRoutes.tsx";

export function Account({
  client,
  repository,
}: {
  client: SupabaseClient;
  repository: CloudRepository;
}) {
  return (
    <AccountProvider client={client} repository={repository}>
      <AccountScreen />
    </AccountProvider>
  );
}

function AccountScreen() {
  const {
    data,
    error,
    busy,
    toast,
    serverNow,
    clock,
    repository,
    refresh,
    mutate,
    patchProfile,
    signOut,
    notify,
  } = useAccount();
  const location = useLocation();
  const go = useNavigate();
  const route = routeForPath(location.pathname);
  const [dialog, setDialog] = useState<CloudDialog | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const revealPending = useRef(false);
  const pagePath =
    location.pathname === "/" ? routePaths.daily : location.pathname;
  useEffect(() => setDialog(null), [pagePath]);
  const dayRef = useRef(clock.day);
  const revealRef = useRef(clock.revealed);
  const loaded = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (!loaded.current) {
      loaded.current = true;
      dayRef.current = clock.day;
      revealRef.current = clock.revealed;
      return;
    }
    if (dayRef.current !== clock.day || revealRef.current !== clock.revealed) {
      dayRef.current = clock.day;
      revealRef.current = clock.revealed;
      setDialog(null);
      refresh().catch((error) => notify(getErrorMessage(error)));
    }
  }, [data, clock.day, clock.revealed, refresh, notify]);
  const profile = data?.profile;
  const canAdmin = data?.adminAccess?.allowed === true;
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

  function handled(promise: Promise<unknown>) {
    promise.catch((error) => notify(getErrorMessage(error)));
  }
  function navigate(next: Route, replace = false) {
    setDialog(null);
    if (location.pathname !== routePaths[next])
      go(routePaths[next], { replace });
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
      <PlaybackContext.Provider
        value={{ player, round, revealed: clock.revealed, cloud: true }}
      >
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
      </PlaybackContext.Provider>
    );
  const tracks = data.tracks;
  const currentTrack = tracks.find((track) => track.id === player.active);
  return (
    <PlaybackContext.Provider
      value={{
        player: { ...player, track: currentTrack },
        round,
        revealed: clock.revealed,
        cloud: true,
      }}
    >
      <audio ref={player.audioRef} preload="metadata" />
      {!profile.onboard || profile.prefs.length > 5 ? (
        <Onboarding
          profile={profile}
          cloud
          busy={busy}
          onFinish={(values) => handled(patchProfile(values))}
        />
      ) : (
        <AccountRoutes
          isArtist={profile.accountType === "artist"}
          canAdmin={canAdmin}
          layout={
            <Layout
              cloud
              admin={canAdmin}
              profile={profile}
              route={route}
              navigate={navigate}
            >
              {error && (
                <p className="error connection-error" role="alert">
                  {error} I progressi non confermati dal server non vengono
                  salvati.
                </p>
              )}
              <Outlet />
            </Layout>
          }
          daily={
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
              onProfile={() => navigate("profile")}
            />
          }
          profile={
            <Profile
              cloud
              busy={busy}
              profile={profile}
              tracks={data.favorites}
              onUpdate={(values) => {
                const promise = patchProfile(values);
                // Gli aggiornamenti del form gestiscono il proprio errore; i pulsanti richiedono feedback.
                if (!values.prefs && !values.accountType) handled(promise);
                return promise;
              }}
              onSave={(id) =>
                handled(mutate(() => repository.favorite(id, true)))
              }
              onAvatarUpload={(file) =>
                mutate(() => repository.uploadAvatar(file, profile.avatarPath))
              }
              onAvatarRemove={() =>
                mutate(() => repository.removeAvatar(profile.avatarPath))
              }
              notify={notify}
              onSignOut={signOut}
            />
          }
          artist={
            <Artist
              cloud
              admin={canAdmin}
              now={new Date(serverNow)}
              applications={profile.applications}
              onSubmit={(application, audio) =>
                mutate(
                  () => repository.submitApplication(application, audio),
                  "Candidatura salvata, in attesa di verifica.",
                )
              }
            />
          }
          ranks={<CloudRankings repository={repository} />}
          admin={
            <Admin
              repository={repository}
              onAccessLost={() => {
                void refresh();
                navigate("daily", true);
              }}
            />
          }
        />
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
    </PlaybackContext.Provider>
  );
}
