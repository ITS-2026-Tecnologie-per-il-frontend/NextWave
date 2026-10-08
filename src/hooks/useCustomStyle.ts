import { useContext } from "react";
import { AppearanceContext } from "../context/appearance/AppearanceContext.ts";

export function useCustomStyle() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("AppearanceProvider mancante.");
  return value;
}
