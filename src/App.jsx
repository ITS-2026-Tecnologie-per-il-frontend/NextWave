import { lazy, Suspense } from "react";
import { getDataConfig } from "./services/supabase.js";
const DemoApp = lazy(() => import("./DemoApp.jsx"));
const CloudApp = lazy(() => import("./features/cloud/CloudApp.jsx"));
const SpotifyPkceCallback = lazy(
  () => import("./features/cloud/SpotifyPkceCallback.jsx"),
);
export default function App() {
  let config;
  try {
    config = getDataConfig();
  } catch (error) {
    return (
      <main className="connection-page">
        <h1>Configurazione incompleta</h1>
        <p role="alert">{error.message}</p>
      </main>
    );
  }
  return (
    <Suspense
      fallback={
        <main className="connection-page">
          <p role="status">Caricamento di Vibe Pulse…</p>
        </main>
      }
    >
      {config.mode === "supabase" &&
      location.pathname === "/auth/spotify/callback" ? (
        <SpotifyPkceCallback />
      ) : config.mode === "supabase" ? (
        <CloudApp />
      ) : (
        <DemoApp />
      )}
    </Suspense>
  );
}
