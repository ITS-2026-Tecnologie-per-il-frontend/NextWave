import { afterEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SpotifyConnection from "../src/features/cloud/SpotifyConnection.jsx";
import { StrictMode } from "react";
import { webcrypto } from "node:crypto";

afterEach(() => vi.unstubAllGlobals());
it("mostra il profilo collegato e scollega usando la sessione Next Wave", async () => {
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "supabase-session" } },
      }),
    },
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        connected: true,
        name: "Ascoltatore Spotify",
        url: "https://open.spotify.com/user/test",
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ connected: false }),
    });
  vi.stubGlobal("fetch", fetchMock);
  render(<SpotifyConnection client={client} />);
  expect(
    await screen.findByText("Collegato come Ascoltatore Spotify"),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Scollega Spotify" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Collega Spotify" }),
    ).toBeTruthy(),
  );
  expect(fetchMock).toHaveBeenLastCalledWith("/api/spotify/connection", {
    method: "DELETE",
    headers: { Authorization: "Bearer supabase-session" },
  });
});
it("avvia la barriera soltanto al clic e prepara una sola autorizzazione in StrictMode", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const client = {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({
          data: {
            session: {
              access_token: "supabase-session",
              user: { id: "user-a" },
            },
          },
        }),
    },
  };
  const calls = [];
  const fetchMock = vi.fn(async (url, options) => {
    calls.push([url, options]);
    const body = url.endsWith("connection")
      ? { connected: false }
      : url.endsWith("pkce-config")
        ? {
            clientId: "public-id",
            redirectUri: "https://example.com/auth/spotify/callback",
            scope: "user-read-private",
          }
        : { error: "Preparazione non disponibile" };
    return {
      ok: !url.endsWith("pkce-prepare"),
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <StrictMode>
      <SpotifyConnection client={client} />
    </StrictMode>,
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(calls.some(([url]) => url.endsWith("pkce-prepare"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Collega Spotify" }));
  expect(await screen.findByText("Preparazione non disponibile")).toBeTruthy();
  const prepared = calls.filter(([url]) => url.endsWith("pkce-prepare"));
  expect(prepared).toHaveLength(1);
  expect(JSON.parse(prepared[0][1].body).state).toMatch(/^[a-f0-9]{64}$/);
  expect(localStorage.getItem("spot_auth_tokens")).toBeNull();
});
