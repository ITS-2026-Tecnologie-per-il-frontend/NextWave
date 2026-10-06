import { expect, it, vi } from "vitest";
import { spotifyJson } from "../server/spotifyHttp.js";
const reply = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
it("rispetta Retry-After e applica attese crescenti", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(reply(429, {}, { "Retry-After": "2" }))
    .mockResolvedValueOnce(reply(429, {}))
    .mockResolvedValueOnce(reply(200, { id: "user" }));
  const sleep = vi.fn().mockResolvedValue();
  expect(
    await spotifyJson("https://api.spotify.com/v1/me", {}, { fetcher, sleep }),
  ).toEqual({ id: "user" });
  expect(sleep.mock.calls).toEqual([[2000], [2000]]);
});
it("non riprova immediatamente quando Retry-After supera il tempo disponibile", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(reply(429, {}, { "Retry-After": "120" }));
  const sleep = vi.fn();
  await expect(
    spotifyJson("https://api.spotify.com/v1/me", {}, { fetcher, sleep }),
  ).rejects.toMatchObject({ message: "rate_limit", retryAfter: 120 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(sleep).not.toHaveBeenCalled();
});
it("riconosce revoca del refresh token, accesso negato e messaggi del provider", async () => {
  for (const [status, body, message] of [
    [
      400,
      { error: "invalid_grant", error_description: "Refresh token revoked" },
      "reauthorize",
    ],
    [403, { error: { message: "Forbidden" } }, "profile_denied"],
    [401, { error: { message: "Expired" } }, "reauthorize"],
  ]) {
    await expect(
      spotifyJson(
        "https://api.spotify.com/v1/me",
        {},
        { fetcher: vi.fn().mockResolvedValue(reply(status, body)) },
      ),
    ).rejects.toMatchObject({ message, status });
  }
});
