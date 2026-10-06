import {
  context,
  user,
  sameOrigin,
  rpc,
  seal,
  unseal,
  hash,
  cookie,
  token,
  noCache,
  fail,
} from "../../server/spotify.js";
import { spotifyJson } from "../../server/spotifyHttp.js";
export default async function handler(req, res) {
  noCache(res);
  if (req.method !== "POST") return res.status(405).end();
  try {
    const ctx = context();
    sameOrigin(ctx, req);
    const id = await user(ctx, req);
    const { code, state, verifier } = req.body || {};
    if (
      typeof code !== "string" ||
      code.length > 2048 ||
      !/^[a-f0-9]{64}$/.test(state || "") ||
      typeof verifier !== "string" ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
    )
      return res
        .status(400)
        .json({ error: "Richiesta di collegamento Spotify non valida." });
    const raw = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("__Host-nw-spotify="))
      ?.slice("__Host-nw-spotify=".length);
    let session;
    try {
      session = unseal(raw || "", ctx.key);
    } catch {
      throw new Error("pkce_session");
    }
    if (
      session.id !== id ||
      session.state !== state ||
      session.expires < Date.now()
    )
      throw new Error("pkce_session");
    cookie(res, "", 0);
    if (!(await rpc(ctx, "consume", id, { hash: hash(state) })))
      throw new Error("pkce_session");
    const credentials = await token(
      ctx,
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: `${ctx.redirect.origin}/auth/spotify/callback`,
        code_verifier: verifier,
      },
      true,
    );
    const profile = await spotifyJson("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
    });
    if (!profile.id || !credentials.refresh_token) throw new Error("spotify");
    await rpc(ctx, "save", id, {
      credentials: seal(
        {
          ...credentials,
          auth_mode: "pkce",
          expires: Date.now() + credentials.expires_in * 1000,
        },
        ctx.key,
      ),
      name: profile.display_name || profile.id,
      id: profile.id,
    });
    res.json({ connected: true });
  } catch (error) {
    cookie(res, "", 0);
    fail(res, error);
  }
}
