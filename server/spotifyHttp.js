// Errori OAuth e Web API restano sul server; al browser arrivano solo messaggi controllati.
export async function spotifyJson(
  url,
  options,
  {
    fetcher = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) return body;
    const retry = response.headers.get("Retry-After");
    const seconds = retry === null ? 0 : Number(retry);
    const retryMs = Number.isFinite(seconds)
      ? Math.max(0, seconds * 1000)
      : Math.max(0, Date.parse(retry) - Date.now()) || 0;
    const delay = Math.max(retryMs, 1000 * 2 ** attempt);
    if (response.status === 429 && attempt < 2 && delay <= 4000) {
      await sleep(delay);
      continue;
    }
    const oauthError = typeof body.error === "string" ? body.error : null;
    const error = new Error(
      response.status === 429
        ? "rate_limit"
        : oauthError === "invalid_grant" || response.status === 401
          ? "reauthorize"
          : response.status === 403
            ? "profile_denied"
            : "spotify",
    );
    error.status = response.status;
    error.retryAfter = Math.ceil(delay / 1000);
    // Lire le message sans l'exposer ni enregistrer le corps, qui peut contenir des données sensibles.
    error.providerMessage =
      typeof body.error?.message === "string"
        ? body.error.message
        : typeof body.error_description === "string"
          ? body.error_description
          : "";
    throw error;
  }
}
