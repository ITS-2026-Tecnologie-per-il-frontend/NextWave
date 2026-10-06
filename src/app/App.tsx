import { getErrorMessage } from "../domain/errors.ts";
import { lazy, Suspense } from "react";
import { getDataConfig } from "../config/environment.ts";
const DemoApp = lazy(() => import("./DemoApp.tsx"));
const CloudApp = lazy(() => import("./CloudApp.tsx"));
export default function App() {
  let config;
  try {
    config = getDataConfig();
  } catch (error) {
    return (
      <main className="connection-page">
        <h1>Configurazione incompleta</h1>
        <p role="alert">{getErrorMessage(error)}</p>
      </main>
    );
  }
  return (
    <Suspense
      fallback={
        <main className="connection-page">
          <p role="status">Caricamento di Next Wave…</p>
        </main>
      }
    >
      {config.mode === "supabase" ? <CloudApp /> : <DemoApp />}
    </Suspense>
  );
}
