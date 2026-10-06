import {
  context,
  user,
  sameOrigin,
  rpc,
  unseal,
  seal,
  token,
  fail,
  noCache,
} from "../../server/spotify.js";
export default async function handler(req, res) {
  noCache(res);
  if (!["GET", "DELETE"].includes(req.method)) return res.status(405).end();
  try {
    const ctx = context();
    const id = await user(ctx, req);
    if (req.method === "DELETE") {
      sameOrigin(ctx, req);
      await rpc(ctx, "delete", id);
      return res.json({ connected: false });
    }
    const stored = await rpc(ctx, "get", id);
    if (!stored) return res.json({ connected: false });
    const credentials = unseal(stored.credentials, ctx.key);
    if (credentials.expires < Date.now() + 60000) {
      let refreshed;
      try {
        refreshed = await token(
          ctx,
          {
            grant_type: "refresh_token",
            refresh_token: credentials.refresh_token,
          },
          credentials.auth_mode === "pkce",
        );
      } catch (error) {
        if (error.message === "reauthorize") {
          await rpc(ctx, "delete", id);
          return res.json({ connected: false, needsAuthorization: true });
        }
        throw error;
      }
      await rpc(ctx, "save", id, {
        ...stored,
        credentials: seal(
          {
            ...refreshed,
            auth_mode: credentials.auth_mode,
            refresh_token: refreshed.refresh_token || credentials.refresh_token,
            expires: Date.now() + refreshed.expires_in * 1000,
          },
          ctx.key,
        ),
      });
    }
    res.json({
      connected: true,
      name: stored.name,
      url: `https://open.spotify.com/user/${encodeURIComponent(stored.id)}`,
    });
  } catch (error) {
    fail(res, error);
  }
}
