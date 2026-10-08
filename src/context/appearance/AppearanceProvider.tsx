import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppearanceContext } from "./AppearanceContext.ts";
import {
  originalStyle,
  readCustomStyle,
  readStyleLibrary,
  saveCustomStyle,
  saveNamedStyle,
  styleVariables,
  type CustomStyle,
} from "../../services/appearance/customStyle.ts";

export function AppearanceProvider({
  children,
  fallback = originalStyle,
}: {
  children: ReactNode;
  fallback?: CustomStyle;
}) {
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
  const style = saved.active ? saved.style : fallback;
  useEffect(() => {
    const root = document.documentElement;
    const vars = styleVariables(style);
    root.dataset.custom = "true";
    Object.entries(vars).forEach(([key, value]) =>
      root.style.setProperty(key, value),
    );
    return () => {
      delete root.dataset.custom;
      Object.keys(vars).forEach((key) => root.style.removeProperty(key));
    };
  }, [style]);
  const value = useMemo(
    () => ({
      ...saved,
      style,
      library,
      applyStyle: saveCustomStyle,
      saveStyle: saveNamedStyle,
    }),
    [saved, style, library],
  );
  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}
