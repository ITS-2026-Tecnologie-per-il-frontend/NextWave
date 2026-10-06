import {
  context,
  rpc,
  seal,
  unseal,
  hash,
  cookie,
  token,
  noCache,
} from "../../server/spotify.js";
export default async function handler(req, res) {
  noCache(res);
  if (req.method !== "GET") return res.status(405).end();
  let ctx;
  try {
    ctx = context();
    const url = new URL(req.url, ctx.redirect.origin);
    const raw = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("__Host-nw-spotify="))
      ?.slice("__Host-nw-spotify=".length);
    cookie(res, "", 0);
    const session = unseal(raw || "", ctx.key);
    if (
      session.expires < Date.now() ||
      session.state !== url.searchParams.get("state")
    )
      throw new Error("state");
    if (!(await rpc(ctx, "consume", session.id, { hash: hash(session.state) })))
      throw new Error("state");
    if (url.searchParams.has("error") || !url.searchParams.get("code"))
      throw new Error("denied");
    const credentials = await token(ctx, {
      grant_type: "authorization_code",
      code: url.searchParams.get("code"),
      redirect_uri: ctx.redirect.href,
      code_verifier: session.verifier,
    });
    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("spotify");
    const profile = await response.json();
    if (!profile.id || !credentials.refresh_token) throw new Error("spotify");
    await rpc(ctx, "save", session.id, {
      credentials: seal(
        { ...credentials, expires: Date.now() + credentials.expires_in * 1000 },
        ctx.key,
      ),
      name: profile.display_name || profile.id,
      id: profile.id,
    });
    res.redirect(303, `${ctx.redirect.origin}/?spotify=connected#profile`);
  } catch {
    cookie(res, "", 0);
    if (ctx) res.redirect(303, `${ctx.redirect.origin}/?spotify=error#profile`);
    else res.status(503).send("Configurazione Spotify incompleta.");
  }
}
