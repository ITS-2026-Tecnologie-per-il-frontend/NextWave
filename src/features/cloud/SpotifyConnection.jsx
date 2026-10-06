import { useEffect, useState } from "react";
import { SpotAuthProvider, SpotAuthBarrier } from "spot-auth/react";
import {
  ownerKey,
  clearPkce,
  spotifyRequest,
} from "../../services/spotifyPkce.js";
export default function SpotifyConnection({ client }) {
  const [connection, setConnection] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pkce, setPkce] = useState(null);
  async function request(endpoint, method = "GET") {
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error("Accedi nuovamente a Next Wave.");
    const response = await fetch(`/api/spotify/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("Spotify è disponibile sul sito Vercel configurato.");
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Spotify non disponibile.");
    return result;
  }
  useEffect(() => {
    let active = true;
    request("connection")
      .then((value) => {
        if (active) {
          setConnection(value);
          if (value.needsAuthorization)
            setError(
              "L'autorizzazione Spotify è scaduta o revocata. Premi Collega Spotify per autorizzare di nuovo.",
            );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    const url = new URL(location.href);
    if (url.searchParams.has("spotify")) {
      if (url.searchParams.get("spotify") === "error") {
        const messages = {
          rate_limit:
            "Spotify ha limitato le richieste. Attendi prima di riprovare.",
          reauthorize:
            "Autorizzazione Spotify non valida. Premi Collega Spotify per riprovare.",
          cookie:
            "La sessione di collegamento Spotify è andata persa. Riprova nello stesso browser, consentendo i cookie di Next Wave.",
          state:
            "Il collegamento è scaduto o già utilizzato. Premi nuovamente Collega Spotify.",
          denied:
            "Autorizzazione Spotify annullata o rifiutata. Riprova e autorizza Next Wave.",
          spotify:
            "Scambio del codice Spotify non riuscito. Verifica Client ID, Client Secret e redirect dell'app su Vercel.",
          profile_denied:
            "Spotify ha negato l'accesso al profilo. Verifica che questo account sia autorizzato in Users Management dell'app Spotify.",
          profile: "Spotify non ha restituito il profilo. Riprova più tardi.",
          database:
            "Salvataggio del collegamento non riuscito. Verifica la migrazione Spotify su Supabase.",
        };
        setError(
          messages[url.searchParams.get("spotify_reason")] ||
            "Autorizzazione Spotify non riuscita. Riprova.",
        );
      }
      url.searchParams.delete("spotify");
      url.searchParams.delete("spotify_reason");
      history.replaceState(null, "", url);
    }
    return () => {
      active = false;
    };
  }, [client]);
  async function act() {
    setBusy(true);
    setError("");
    try {
      if (connection?.connected)
        setConnection(await request("connection", "DELETE"));
      else {
        clearPkce();
        const { data } = await client.auth.getSession();
        if (!data.session) throw new Error("Accedi nuovamente a Next Wave.");
        sessionStorage.setItem(ownerKey, data.session.user.id);
        setPkce(await spotifyRequest(client, "pkce-config"));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Il tuo Spotify</h2>
      <p>
        {connection?.connected
          ? `Collegato come ${connection.name}`
          : "Collega il tuo account Spotify a Next Wave."}
      </p>
      <p className="hint">
        I generi scelti e gli ascolti del contest restano gestiti da Next Wave.
      </p>
      {connection?.connected && (
        <p>
          <a href={connection.url} target="_blank" rel="noreferrer">
            Apri il profilo su Spotify
          </a>
        </p>
      )}
      <button className="btn secondary" disabled={busy || !!pkce} onClick={act}>
        {busy
          ? "Attendi…"
          : connection?.connected
            ? "Scollega Spotify"
            : "Collega Spotify"}
      </button>
      {pkce && (
        <SpotAuthProvider
          clientId={pkce.clientId}
          scope={pkce.scope}
          redirectUri={pkce.redirectUri}
          beforeAuthorize={async ({ state }) => {
            const { data } = await client.auth.getSession();
            if (data.session?.user.id !== sessionStorage.getItem(ownerKey))
              throw new Error(
                "L'account Next Wave è cambiato. Ripeti il collegamento.",
              );
            await spotifyRequest(client, "pkce-prepare", "POST", { state });
          }}
        >
          <SpotAuthBarrier
            fallback={
              <p role="status">Apertura dell'autorizzazione Spotify…</p>
            }
            onError={(e) => {
              clearPkce();
              setPkce(null);
              setError(e.message);
            }}
          >
            <p>Autorizzazione Spotify pronta.</p>
          </SpotAuthBarrier>
        </SpotAuthProvider>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
