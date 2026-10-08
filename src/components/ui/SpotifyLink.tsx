import type { Track } from "../../types/models.ts";

export function SpotifyLink({
  track,
}: {
  track: Pick<Track, "spotifyUrl" | "isDemo">;
}) {
  if (!track.spotifyUrl) return null;
  return (
    <a
      className="textbtn"
      href={track.spotifyUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {track.isDemo
        ? "Link Spotify di esempio ↗"
        : /^https:\/\/open\.spotify\.com\//.test(track.spotifyUrl)
          ? "Apri il brano su Spotify ↗"
          : "Apri il brano ↗"}
    </a>
  );
}
