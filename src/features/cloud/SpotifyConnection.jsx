import { useEffect, useState } from "react";
export default function SpotifyConnection({ client }) {
  const [connection, setConnection] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        if (active) setConnection(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    const url = new URL(location.href);
    if (url.searchParams.has("spotify")) {
      if (url.searchParams.get("spotify") === "error") {
        const messages = {
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
        const result = await request("start", "POST");
        location.assign(result.url);
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
      <button className="btn secondary" disabled={busy} onClick={act}>
        {busy
          ? "Attendi…"
          : connection?.connected
            ? "Scollega Spotify"
            : "Collega Spotify"}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
