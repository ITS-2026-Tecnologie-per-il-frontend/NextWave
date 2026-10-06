import { useEffect, useRef, useState } from "react";
import { getSupabase } from "../../services/supabase.js";
import {
  callbackPayload,
  clearPkce,
  spotifyRequest,
} from "../../services/spotifyPkce.js";
export default function SpotifyPkceCallback() {
  const pending = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!pending.current)
      pending.current = (async () => {
        const client = getSupabase();
        const { data } = await client.auth.getSession();
        const body = callbackPayload(
          new URL(location.href),
          data.session?.user.id,
        );
        // Remove the authorization code from browser history before the exchange.
        history.replaceState(null, "", "/auth/spotify/callback");
        await spotifyRequest(client, "pkce-complete", "POST", body);
      })();
    pending.current
      .then(() => {
        if (active) {
          clearPkce();
          location.replace("/#profile");
        }
      })
      .catch((e) => {
        if (active) {
          clearPkce();
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="connection-page">
      <h1>Collegamento Spotify</h1>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <a href="/#profile">Torna al profilo Next Wave</a>
        </>
      ) : (
        <p role="status">Completamento dell'autorizzazione…</p>
      )}
    </main>
  );
}
