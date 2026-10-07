import { useEffect, useState } from "react";
import { readCustomStyle, styleVariables } from "../services/customStyle.ts";
export function useCustomStyle(apply = false) {
  const [saved, setSaved] = useState(readCustomStyle);
  useEffect(() => {
    const sync = () => setSaved(readCustomStyle());
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
    const vars = styleVariables(saved.style);
    root.dataset.custom = String(saved.active);
    if (saved.active)
      Object.entries(vars).forEach(([key, value]) =>
        root.style.setProperty(key, value),
      );
    return () => {
      delete root.dataset.custom;
      Object.keys(vars).forEach((key) => root.style.removeProperty(key));
    };
  }, [saved, apply]);
  return saved;
}
