import { useContext } from "react";
import { PlaybackContext } from "../context/playback/PlaybackContext.ts";

export function usePlayback() {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("PlaybackContext.Provider mancante.");
  return value;
}
