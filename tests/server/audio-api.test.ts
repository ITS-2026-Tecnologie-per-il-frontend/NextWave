import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, expect, test, vi } from "vitest";
import handler from "../../api/audio.ts";

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({
    data: { user: null },
    error: { message: "invalid JWT" },
  })),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser }, storage: { from: () => ({}) } }),
}));
afterEach(() => vi.unstubAllEnvs());

async function request(body: unknown, token = "", method = "POST") {
  const req = {
    method,
    body,
    headers: { authorization: `Bearer ${token}` },
  } as IncomingMessage & { body: unknown };
  const response = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
  await handler(req, response as unknown as ServerResponse);
  return response;
}
function configure() {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "admin-test");
  vi.stubEnv("AUDIO_CLEANUP_SECRET", "test-cleanup-secret");
}
test("il server segnala la configurazione assente senza mostrare chiavi", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  const response = await request({ action: "play", id: "id" });
  expect(response.statusCode).toBe(503);
  expect(response.end.mock.calls[0][0]).toContain("non configurato");
});
test("la pulizia richiede il segreto e non accetta il token di un utente", async () => {
  configure();
  expect((await request({ action: "cleanup" }, "user-token")).statusCode).toBe(
    401,
  );
});
test("un JWT non verificato non autorizza upload o ascolti", async () => {
  configure();
  expect(
    (await request({ action: "prepare", data: {} }, "invalid-token"))
      .statusCode,
  ).toBe(401);
  expect(getUser).toHaveBeenCalledWith("invalid-token");
});
test("la moderazione non è accessibile attraverso l’endpoint pubblico", async () => {
  configure();
  expect((await request({ action: "approve" })).statusCode).toBe(400);
  expect((await request({}, "", "GET")).statusCode).toBe(405);
});
