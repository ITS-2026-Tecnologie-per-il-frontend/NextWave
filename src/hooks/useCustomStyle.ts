import { useEffect, useState } from "react";
import {
  originalStyle,
  readCustomStyle,
  readStyleLibrary,
  styleVariables,
  type CustomStyle,
} from "../services/appearance/customStyle.ts";
export function useCustomStyle(
  apply = false,
  fallback: CustomStyle = originalStyle,
) {
  const [saved, setSaved] = useState(readCustomStyle);
  const [library, setLibrary] = useState(readStyleLibrary);
  useEffect(() => {
    const sync = () => {
      setSaved(readCustomStyle());
      setLibrary(readStyleLibrary());
    };
    window.addEventListener("nextwave-style", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nextwave-style", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (!apply) return;
    const root = document.documentElement;
    const vars = styleVariables(saved.active ? saved.style : fallback);
    root.dataset.custom = "true";
    Object.entries(vars).forEach(([key, value]) =>
      root.style.setProperty(key, value),
    );
    return () => {
      delete root.dataset.custom;
      Object.keys(vars).forEach((key) => root.style.removeProperty(key));
    };
  }, [saved, apply, fallback]);
  return { ...saved, style: saved.active ? saved.style : fallback, library };
}
