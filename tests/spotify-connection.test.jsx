import { afterEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SpotifyConnection from "../src/features/cloud/SpotifyConnection.jsx";

afterEach(() => vi.unstubAllGlobals());
it("mostra il profilo collegato e scollega usando la sessione Next Wave", async () => {
  const client = {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({
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
