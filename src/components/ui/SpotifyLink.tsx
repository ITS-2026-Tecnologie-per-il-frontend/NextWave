import type { Track } from "../../types/models.ts";
import { Icon } from "./Icon.tsx";

export function SpotifyLink({
  track,
}: {
  track: Pick<Track, "spotifyUrl" | "isDemo">;
}) {
  if (!track.spotifyUrl) return null;
  const spotify = /^https:\/\/open\.spotify\.com\//.test(track.spotifyUrl);
  const label = track.isDemo
    ? "Link Spotify di esempio"
    : spotify
      ? "Apri il brano su Spotify"
      : "Apri il brano";
  return (
    <a
      className={`music-link ${spotify ? "music-link-spotify" : "music-link-external"}`}
      href={track.spotifyUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
    >
      {spotify ? (
        <img
          src="/images/brands/spotify-icon-green.svg"
          alt=""
          width="24"
          height="24"
        />
      ) : (
        <Icon name="artist" />
      )}
      <span>
        {track.isDemo
          ? "Spotify · esempio"
          : spotify
            ? "Apri Spotify"
            : "Apri il brano"}
      </span>
      <span className="music-link-arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}
