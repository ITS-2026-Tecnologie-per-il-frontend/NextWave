import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, expect, test, vi } from "vitest";
import handler from "../../api/audio.ts";

const { getUser, rpc, signedUrl } = vi.hoisted(() => ({
  getUser: vi.fn(
    async (
      _token: string,
    ): Promise<{
      data: { user: { id: string } | null };
      error: { message: string } | null;
    }> => ({
      data: { user: null },
      error: { message: "invalid JWT" },
    }),
  ),
  rpc: vi.fn(
    async (
      _name: string,
      _data: unknown,
    ): Promise<{
      data: { path: string } | null;
      error: { code: string } | null;
    }> => ({ data: null, error: { code: "42501" } }),
  ),
  signedUrl: vi.fn(async () => ({
    data: { signedUrl: "https://storage.example/review.mp3" },
    error: null,
  })),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser },
    rpc,
    storage: { from: () => ({ createSignedUrl: signedUrl }) },
  }),
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
}
test("il server segnala la configurazione assente senza mostrare chiavi", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  const response = await request({ action: "play", id: "id" });
  expect(response.statusCode).toBe(503);
  expect(response.end.mock.calls[0][0]).toContain("non configurato");
});
test("la pulizia rimossa viene rifiutata prima di verificare il token", async () => {
  configure();
  expect((await request({ action: "cleanup" }, "user-token")).statusCode).toBe(
    400,
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

test("la firma audio admin richiede autorizzazione dal database", async () => {
  configure();
  signedUrl.mockClear();
  getUser.mockResolvedValueOnce({
    data: { user: { id: "regular-user" } },
    error: null,
  });
  const response = await request(
    { action: "admin-preview", id: "11111111-1111-1111-1111-111111111111" },
    "regular-token",
  );
  expect(response.statusCode).toBe(403);
  expect(signedUrl).not.toHaveBeenCalled();
});

test("un admin verificato riceve un ascolto privato di dieci minuti", async () => {
  configure();
  getUser.mockResolvedValueOnce({
    data: { user: { id: "admin-user" } },
    error: null,
  });
  rpc.mockResolvedValueOnce({
    data: { path: "tracks/11111111-1111-1111-1111-111111111111.mp3" },
    error: null,
  });
  const response = await request(
    { action: "admin-preview", id: "11111111-1111-1111-1111-111111111111" },
    "admin-token",
  );
  expect(response.statusCode).toBe(200);
  expect(signedUrl).toHaveBeenCalledWith(
    "tracks/11111111-1111-1111-1111-111111111111.mp3",
    600,
  );
});
