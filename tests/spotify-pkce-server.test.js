import { beforeEach, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  user: vi.fn(),
  rpc: vi.fn(),
  token: vi.fn(),
  profile: vi.fn(),
}));
vi.mock("../server/spotify.js", async (original) => ({
  ...(await original()),
  context: mocks.context,
  user: mocks.user,
  rpc: mocks.rpc,
  token: mocks.token,
}));
vi.mock("../server/spotifyHttp.js", () => ({ spotifyJson: mocks.profile }));
import complete from "../api/spotify/pkce-complete.js";
import { seal, unseal } from "../server/spotify.js";
let ctx;
const state = "a".repeat(64);
function response() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    end: vi.fn(),
  };
}
function request(owner = "user-a") {
  return {
    method: "POST",
    headers: {
      origin: "https://example.com",
      cookie: `__Host-nw-spotify=${seal({ id: owner, state, expires: Date.now() + 600000 }, ctx.key)}`,
    },
    body: { code: "code", state, verifier: "v".repeat(43) },
  };
}
beforeEach(() => {
  ctx = {
    key: randomBytes(32),
    redirect: new URL("https://example.com/api/spotify/callback"),
  };
  mocks.context.mockReturnValue(ctx);
  mocks.user.mockResolvedValue("user-a");
  mocks.rpc.mockResolvedValue({});
  mocks.token.mockResolvedValue({
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
  });
  mocks.profile.mockResolvedValue({ id: "spotify-a", display_name: "Artist" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
it("scambia codice con PKCE e conserva i token cifrati senza restituirli al browser", async () => {
  const res = response();
  await complete(request(), res);
  expect(mocks.token).toHaveBeenCalledWith(
    ctx,
    expect.objectContaining({
      code_verifier: "v".repeat(43),
      redirect_uri: "https://example.com/auth/spotify/callback",
    }),
    true,
  );
  const saved = mocks.rpc.mock.calls.find((call) => call[1] === "save")[3];
  expect(unseal(saved.credentials, ctx.key)).toMatchObject({
    access_token: "access",
    refresh_token: "refresh",
    auth_mode: "pkce",
  });
  expect(res.json).toHaveBeenCalledWith({ connected: true });
});
it("rifiuta un cookie associato a un altro utente prima di scambiare il codice", async () => {
  mocks.token.mockClear();
  const res = response();
  await complete(request("user-b"), res);
  expect(mocks.token).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ code: "pkce_session" }),
  );
});
it("rifiuta il riutilizzo dello state monouso", async () => {
  mocks.token.mockClear();
  mocks.rpc.mockResolvedValue(null);
  const res = response();
  await complete(request(), res);
  expect(mocks.token).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ code: "pkce_session" }),
  );
});
