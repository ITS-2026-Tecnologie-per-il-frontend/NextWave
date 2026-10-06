import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { spotifyJson } from "./spotifyHttp.js";

export function seal(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function unseal(value, key) {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      cipher.update(bytes.subarray(28)),
      cipher.final(),
    ]).toString(),
  );
}
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function context() {
  const env = process.env;
  const key = Buffer.from(env.SPOTIFY_TOKEN_ENCRYPTION_KEY || "", "base64");
  if (
    key.length !== 32 ||
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.SPOTIFY_CLIENT_SECRET ||
    !env.SPOTIFY_CLIENT_ID ||
    !env.SPOTIFY_REDIRECT_URI
  )
    throw new Error("configuration");
  const redirect = new URL(env.SPOTIFY_REDIRECT_URI);
  if (
    redirect.protocol !== "https:" ||
    redirect.pathname !== "/api/spotify/callback"
  )
    throw new Error("configuration");
  const db = createClient(
    env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return { key, redirect, env, db };
}
export async function rpc(ctx, action, user, payload = {}) {
  const { data, error } = await ctx.db.rpc("spotify_server", {
    p_action: action,
    p_user: user,
    p_payload: payload,
  });
  if (error) {
    const failure = new Error("database");
    failure.code = error.code;
    throw failure;
  }
  return data;
}
export async function user(ctx, req) {
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith("Bearer ")) throw new Error("unauthorized");
  const { data, error } = await ctx.db.auth.getUser(bearer.slice(7));
  if (error?.message?.toLowerCase().includes("api key"))
    throw new Error("supabase_key");
  if (error || !data.user) throw new Error("unauthorized");
  return data.user.id;
}
export function sameOrigin(ctx, req) {
  if (req.headers.origin !== ctx.redirect.origin) throw new Error("origin");
}
export function cookie(res, value, age = 600) {
  res.setHeader(
    "Set-Cookie",
    `__Host-nw-spotify=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`,
  );
}
export async function token(ctx, fields) {
  const data = await spotifyJson("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${ctx.env.SPOTIFY_CLIENT_ID}:${ctx.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15000),
  });
  if (!data.access_token || !Number.isFinite(data.expires_in))
    throw new Error("spotify");
  return data;
}
export function fail(res, error) {
  const messages = {
    unauthorized: "Sessione Next Wave non valida. Esci e accedi nuovamente.",
    origin:
      "Apri Next Wave su https://next-wave-iota.vercel.app e riprova: il dominio deve coincidere con SPOTIFY_REDIRECT_URI.",
    configuration:
      "Configurazione server Spotify incompleta: verifica le variabili Production e avvia un nuovo deploy.",
    supabase_key:
      "La chiave server Supabase non è valida. Verifica SUPABASE_SERVICE_ROLE_KEY su Vercel.",
    database:
      "Il server non riesce ad accedere alla funzione Spotify su Supabase. Verifica che update-spotify.sql sia stato eseguito nel progetto corretto.",
    spotify:
      "Spotify non ha accettato la richiesta. Verifica le credenziali dell'app Spotify.",
    reauthorize:
      "L'autorizzazione Spotify è scaduta o revocata. Scollega e collega nuovamente Spotify.",
    rate_limit: "Spotify ha limitato le richieste. Attendi prima di riprovare.",
  };
  const code = Object.hasOwn(messages, error.message)
    ? error.message
    : "unavailable";
  // Solo codici diagnostici: non registrare token, header o valori delle variabili.
  console.error("Spotify request failed", { code, databaseCode: error.code });
  if (code === "rate_limit")
    res.setHeader("Retry-After", String(error.retryAfter));
  res
    .status(
      code === "rate_limit"
        ? 429
        : code === "unauthorized"
          ? 401
          : code === "origin"
            ? 403
            : 503,
    )
    .json({
      code,
      error:
        messages[code] ||
        "Collegamento Spotify temporaneamente non disponibile. Riprova.",
    });
}
export function noCache(res) {
  res.setHeader("Cache-Control", "no-store");
}
