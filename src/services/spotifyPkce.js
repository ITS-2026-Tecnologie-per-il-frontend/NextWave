export const ownerKey = "nextwave_spotify_pkce_owner";
export function clearPkce() {
  sessionStorage.removeItem(ownerKey);
  sessionStorage.removeItem("spot_auth_state");
  sessionStorage.removeItem("spot_auth_verifier");
  // The library normally saves the return URL in localStorage; we use a fixed safe route.
  localStorage.removeItem("spot_auth_return_url");
}
export async function spotifyRequest(client, endpoint, method = "GET", body) {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("Accedi nuovamente a Next Wave.");
  const response = await fetch(`/api/spotify/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Spotify è disponibile sul sito Vercel configurato.");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Spotify non disponibile.");
  return result;
}
export function callbackPayload(url, owner) {
  if (!owner || owner !== sessionStorage.getItem(ownerKey))
    throw new Error(
      "L'account Next Wave è cambiato. Torna al profilo e ripeti il collegamento.",
    );
  const state = url.searchParams.get("state");
  if (!state || state !== sessionStorage.getItem("spot_auth_state"))
    throw new Error(
      "Sessione Spotify non valida o scaduta. Ripeti il collegamento dal profilo.",
    );
  if (url.searchParams.has("error"))
    throw new Error("Autorizzazione Spotify annullata o rifiutata.");
  const code = url.searchParams.get("code");
  const verifier = sessionStorage.getItem("spot_auth_verifier");
  if (!code || !verifier)
    throw new Error("Codice Spotify mancante. Ripeti il collegamento.");
  return { code, state, verifier };
}
