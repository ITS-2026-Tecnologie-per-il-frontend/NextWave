interface DataEnvironment {
  VITE_DATA_MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  PROD?: boolean;
}
type DataConfig =
  { mode: "demo" } | { mode: "supabase"; url: string; key: string };
export function getDataConfig(
  env: DataEnvironment = import.meta.env,
): DataConfig {
  const mode = env.VITE_DATA_MODE || (env.PROD ? "supabase" : "demo");
  if (!["demo", "supabase"].includes(mode))
    throw new Error("VITE_DATA_MODE deve essere demo o supabase.");
  if (mode === "demo") return { mode };
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
