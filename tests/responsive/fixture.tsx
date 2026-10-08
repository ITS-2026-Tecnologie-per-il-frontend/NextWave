import { PlaybackContext } from "../../src/context/playback/PlaybackContext.ts";
import { MemoryRouter, useLocation } from "react-router-dom";
import { routeForPath } from "../../src/config/routes.ts";
// Real components with isolated in-memory data. Never imported by the product entry point.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudRepository } from "../../src/services/cloud/cloudRepository.ts";
import type {
  AdminDashboard,
  Player,
  Profile as ProfileModel,
  RankingRow,
  Round,
  Route,
} from "../../src/types/models.ts";
import Layout from "../../src/components/layout/Layout.tsx";
import Daily from "../../src/screens/contest/Daily.tsx";
import Profile from "../../src/screens/account/Profile.tsx";
import Artist from "../../src/screens/artist/Artist.tsx";
import Admin from "../../src/screens/admin/Admin.tsx";
import CloudRankings from "../../src/screens/rankings/CloudRankings.tsx";
import Auth from "../../src/screens/auth/Auth.tsx";
import Onboarding from "../../src/screens/auth/Onboarding.tsx";
import Dialog from "../../src/components/dialogs/Dialog.tsx";
import Reveal from "../../src/components/contest/Reveal.tsx";
import AvatarCropDialog from "../../src/components/dialogs/AvatarCropDialog.tsx";
import {
  originalStyle,
  saveNamedStyle,
} from "../../src/services/appearance/customStyle.ts";
import "../../src/styles/index.css";

const stress = new URLSearchParams(location.search).get("stress") !== "false";
if (new URLSearchParams(location.search).get("screen") === "library") {
  for (let index = 0; index < 4; index++)
    saveNamedStyle(
      stress
        ? "IlMioStilePersonaleConNomeLungo" + index
        : "Atmosfera " + (index + 1),
      originalStyle,
    );
}
const longText = stress
  ? "UnaTracciaConUnTitoloMoltoLungoSenzaSpazi".repeat(3)
  : "Nuove prospettive";
const day = "2026-10-08";
const rows: RankingRow[] = Array.from({ length: 5 }, (_, index) => ({
  id: `track-${index}`,
  title: longText,
  artist: longText,
  genre: ["Rap", "Hip hop", "Elettronica", "R&B", "Indie"][index],
  mood: "Energico",
  lang: "Italiano",
  votes: 9999,
  exposures: 10000,
  score: 0.9999,
  spotifyUrl: "https://open.spotify.com/track/1111111111111111111111",
}));
const round: Round = {
  day,
  ids: rows.map((row) => row.id),
  listened: rows.map((row) => row.id),
  vote: rows[0].id,
};
const profile: ProfileModel = {
  uid: "fixture-user",
  name: stress ? "NomeUtenteMoltoLungoSenzaSpazi12345" : "Artista Next Wave",
  accountType: "artist",
  theme: "pulse",
  prefs: rows.map((row) => row.genre),
  onboard: true,
  rounds: { [day]: round },
  saved: round.ids,
  seenReveals: [],
  applications: [],
};
const player: Player = {
  active: rows[0].id,
  playing: false,
  loading: false,
  time: 70,
  duration: 1800,
  volume: 0.8,
  track: rows[0],
  audioRef: { current: null },
  play: async () => {},
  rewind: () => {},
  setVolume: () => {},
};
const application = {
  id: "application-1",
  artist: longText,
  title: longText,
  listeners: 9999,
  subgenre: longText,
  genre: "Rap",
  language: "Italiano",
  mood: "Intimo",
  spotify: "https://open.spotify.com/track/1111111111111111111111",
  status: "pending",
  created: "2026-10-08T08:00:00Z",
  submittedAt: "2026-10-08T08:00:00Z",
  audioState: new URLSearchParams(location.search).has("missingAudio")
    ? null
    : "ready",
  duration: 1800,
  expires: null,
  reviewable: !new URLSearchParams(location.search).has("missingAudio"),
  reviewNote: null,
  reviewedAt: null,
};
const adminData: AdminDashboard = {
  access: { allowed: true, owner: true },
  applications: [
    application,
    {
      ...application,
      id: "approved",
      status: "approved",
      contestDay: "2099-10-08",
    },
  ],
  accounts: [
    {
      id: "owner",
      name: longText,
      avatarPath: "owner/profile.png",
      avatarUrl: "/images/art.png",
      email: `${"nome".repeat(45)}@example.com`,
      owner: true,
      created: null,
    },
    {
      id: "other",
      name: "Admin senza immagine",
      email: "admin@example.com",
      owner: false,
      created: null,
    },
  ],
};
const repository = {
  rankings: async () => ({ reference: day, latestDay: day, rows }),
  adminDashboard: async () => adminData,
  adminAction: async () => {},
} as unknown as CloudRepository;
const client = {
  auth: {
    signUp: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: {}, error: null }),
  },
} as unknown as SupabaseClient;

function CropFixture() {
  const [file] = useState(() => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360"><path fill="red" d="M0 0h360v360H0z"/><path fill="blue" d="M360 0h360v360H360z"/></svg>';
    return new File([svg], "test.svg", { type: "image/svg+xml" });
  });
  const [result, setResult] = useState("");
  return (
    <>
      <AvatarCropDialog
        file={file}
        onCancel={() => {}}
        onConfirm={async (output) => {
          const bitmap = await createImageBitmap(output);
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 640;
          const context = canvas.getContext("2d")!;
          context.drawImage(bitmap, 0, 0);
          bitmap.close();
          setResult(
            JSON.stringify({
              left: [...context.getImageData(80, 320, 1, 1).data],
              middle: [...context.getImageData(384, 320, 1, 1).data],
              right: [...context.getImageData(560, 320, 1, 1).data],
            }),
          );
        }}
      />
      <output data-testid="crop-result">{result}</output>
    </>
  );
}

function Fixture() {
  const routerLocation = useLocation();
  const params = new URLSearchParams(location.search);
  const screen = params.get("screen") || "daily";
  const [route, setRoute] = useState<Route>(
    screen === "rankings"
      ? "ranks"
      : ["studio", "library"].includes(screen)
        ? "profile"
        : ["artist", "admin", "profile"].includes(screen)
          ? (screen as Route)
          : "daily",
  );
  useEffect(() => {
    if (routerLocation.pathname !== "/")
      setRoute(routeForPath(routerLocation.pathname));
  }, [routerLocation.pathname]);
  if (screen === "auth") return <Auth client={client} />;
  if (screen === "onboarding")
    return (
      <Onboarding
        profile={{ ...profile, onboard: false }}
        onFinish={() => {}}
        cloud
      />
    );
  if (screen === "crop") return <CropFixture />;
  const revealed = ["revealed", "reveal"].includes(screen);
  const activeRound =
    screen === "empty" ? { ...round, ids: [], listened: [] } : round;
  return (
    <PlaybackContext.Provider
      value={{
        player,
        round: activeRound,
        revealed,
        cloud: true,
        saved: true,
        onSave: () => {},
      }}
    >
      <Layout
        profile={{
          ...profile,
          accountType:
            params.get("account") === "listener" ? "listener" : "artist",
        }}
        route={route}
        navigate={setRoute}
        cloud
        admin={params.get("admin") !== "false"}
      >
        {route === "profile" ? (
          <Profile
            profile={profile}
            tracks={rows}
            onUpdate={() => {}}
            onSave={() => {}}
            notify={() => {}}
            cloud
            onSignOut={() => {}}
            onAvatarUpload={async () => {}}
            onAvatarRemove={async () => {}}
          />
        ) : route === "artist" ? (
          <Artist
            applications={[application]}
            onSubmit={() => {}}
            cloud
            admin
          />
        ) : route === "admin" ? (
          <Admin repository={repository} onAccessLost={() => {}} />
        ) : route === "ranks" ? (
          <CloudRankings repository={repository} />
        ) : (
          <Daily
            round={activeRound}
            clock={{ day, seconds: 12 * 3600, revealed }}
            revealed={revealed}
            preview={false}
            player={player}
            saved={[]}
            tracks={rows}
            cloud
            onVote={() => {}}
            onSave={() => {}}
            onReveal={() => {}}
            onRanks={() => setRoute("ranks")}
          />
        )}
        {screen === "reveal" && (
          <Dialog reveal onClose={() => {}}>
            <Reveal
              round={round}
              rows={rows}
              preview={false}
              onClose={() => {}}
              onRanks={() => {}}
            />
          </Dialog>
        )}
        {screen === "vote" && (
          <Dialog onClose={() => {}}>
            <h2>Confermi il tuo voto?</h2>
            <p>La tua scelta dà spazio a una nuova voce.</p>
            <div className="actions">
              <button className="btn">Conferma voto</button>
              <button className="btn secondary">Annulla</button>
            </div>
          </Dialog>
        )}
        <div id="toast" style={{ display: "block" }} role="status">
          Preferenze salvate per domani.
        </div>
      </Layout>
    </PlaybackContext.Provider>
  );
}
createRoot(document.getElementById("app")!).render(
  <MemoryRouter>
    <Fixture />
  </MemoryRouter>,
);
