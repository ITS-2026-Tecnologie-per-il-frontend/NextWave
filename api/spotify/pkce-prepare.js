import {
  context,
  user,
  sameOrigin,
  rpc,
  seal,
  hash,
  cookie,
  noCache,
  fail,
} from "../../server/spotify.js";
export default async function handler(req, res) {
  noCache(res);
  if (req.method !== "POST") return res.status(405).end();
  try {
    const ctx = context();
    sameOrigin(ctx, req);
    const id = await user(ctx, req);
    const state = req.body?.state;
    if (typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state))
      return res.status(400).json({ error: "Sessione Spotify non valida." });
    await rpc(ctx, "start", id, { hash: hash(state) });
    cookie(res, seal({ id, state, expires: Date.now() + 600000 }, ctx.key));
    res.json({ ready: true });
  } catch (error) {
    fail(res, error);
  }
}
