import { randomBytes, createHash } from "node:crypto";
import {
  context,
  user,
  sameOrigin,
  rpc,
  seal,
  hash,
  cookie,
  fail,
  noCache,
} from "../../server/spotify.js";
export default async function handler(req, res) {
  noCache(res);
  if (req.method !== "POST") return res.status(405).end();
  try {
    const ctx = context();
    sameOrigin(ctx, req);
    const id = await user(ctx, req);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    await rpc(ctx, "start", id, { hash: hash(state) });
    cookie(
      res,
      seal({ id, state, verifier, expires: Date.now() + 600000 }, ctx.key),
    );
    const params = new URLSearchParams({
      client_id: ctx.env.SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: ctx.redirect.href,
      state,
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      scope: "user-read-private",
    });
    res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
  } catch (error) {
    fail(res, error);
  }
}
