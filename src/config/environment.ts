interface DataEnvironment {
  VITE_SITE_URL?: string;
  VITE_DATA_MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  PROD?: boolean;
}
export function getAuthRedirectUrl(
  env: DataEnvironment = import.meta.env,
): string {
  const url = new URL(
    env.VITE_SITE_URL?.trim() || "https://next-wave-iota.vercel.app/",
  );
  if (
    url.protocol !== "https:" ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "VITE_SITE_URL deve essere il dominio pubblico HTTPS del sito.",
    );
  return `${url.origin}/`;
}
type DataConfig =
  { mode: "demo" } | { mode: "supabase"; url: string; key: string };
export function getDataConfig(
  env: DataEnvironment = import.meta.env,
): DataConfig {
  const mode = env.VITE_DATA_MODE || "supabase";
  if (!["demo", "supabase"].includes(mode))
    throw new Error("VITE_DATA_MODE deve essere demo o supabase.");
  if (mode === "demo")
    throw new Error(
      "La modalità demo è disattivata. Imposta VITE_DATA_MODE=supabase per usare dati reali.",
    );
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Configura URL e chiave pubblica Supabase nelle variabili di ambiente.",
    );
  if (key.startsWith("sb_secret_"))
    throw new Error(
      "Una chiave segreta non può essere usata nel browser. Usa la publishable key.",
    );
  if (!key.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(atob(key.split(".")[1]));
      if (payload.role !== "anon") throw new Error();
    } catch {
      throw new Error(
        "Usa una chiave publishable oppure anon, mai service_role.",
      );
    }
  }
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
    throw new Error("L’URL Supabase remoto deve usare HTTPS.");
  return { mode: "supabase", url, key };
}
