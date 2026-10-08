import { createContext } from "react";
import type { Player, Round } from "../../types/models.ts";

export const PlaybackContext = createContext<{
  player: Player;
  round: Round;
  revealed: boolean;
  cloud: boolean;
} | null>(null);
