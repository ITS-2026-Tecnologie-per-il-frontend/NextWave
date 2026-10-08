import { render, screen } from "@testing-library/react";
import { test, expect } from "vitest";
import { SpotifyLink } from "../../src/components/ui/SpotifyLink.tsx";

test("mostra il logo ufficiale soltanto per i collegamenti Spotify", () => {
  const { rerender } = render(
    <SpotifyLink
      track={{ spotifyUrl: "https://open.spotify.com/track/example" }}
    />,
  );
  const spotify = screen.getByRole("link", {
    name: "Apri il brano su Spotify",
  });
  expect(spotify.querySelector("img")?.getAttribute("src")).toBe(
    "/images/brands/spotify-icon-green.svg",
  );
  expect(spotify.getAttribute("rel")).toBe("noopener noreferrer");
  rerender(
    <SpotifyLink track={{ spotifyUrl: "https://suno.com/song/example" }} />,
  );
  const external = screen.getByRole("link", { name: "Apri il brano" });
  expect(external.querySelector("img")).toBeNull();
  expect(external.getAttribute("href")).toBe("https://suno.com/song/example");
  rerender(<SpotifyLink track={{ spotifyUrl: null }} />);
  expect(screen.queryByRole("link")).toBeNull();
});
