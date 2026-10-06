import { context, user, noCache, fail } from "../../server/spotify.js";
export default async function handler(req, res) {
  noCache(res);
  if (req.method !== "GET") return res.status(405).end();
  try {
    const ctx = context();
    await user(ctx, req);
    res.json({
      clientId: ctx.env.SPOTIFY_CLIENT_ID,
      redirectUri: `${ctx.redirect.origin}/auth/spotify/callback`,
      scope: "user-read-private",
    });
  } catch (error) {
    fail(res, error);
  }
}
