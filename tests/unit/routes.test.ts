import { describe, expect, test } from "vitest";
import { migrateLegacyPageLink } from "../../src/config/routes.ts";
import vercel from "../../vercel.json";

describe("compatibilità dei collegamenti", () => {
  test.each(["daily", "ranks", "artist", "profile", "admin"])(
    "converte #%s preservando la query",
    (page) => {
      history.replaceState(null, "", `/?source=email#${page}`);
      migrateLegacyPageLink();
      expect(location.pathname).toBe(`/${page}`);
      expect(location.search).toBe("?source=email");
      expect(location.hash).toBe("");
    },
  );
  test.each([
    "#access_token=example&refresh_token=example",
    "#error=access_denied",
    "#unknown",
  ])("non altera il frammento %s", (hash) => {
    history.replaceState(null, "", "/" + hash);
    migrateLegacyPageLink();
    expect(location.pathname).toBe("/");
    expect(location.hash).toBe(hash);
  });
  test("il fallback delle pagine esclude API e risorse statiche", () => {
    const source = vercel.rewrites[0].source;
    const pattern = new RegExp("^/" + source.slice("/:path(".length, -1) + "$");
    for (const path of ["/daily", "/profile", "/admin", "/pagina-inesistente"])
      expect(pattern.test(path)).toBe(true);
    for (const path of [
      "/api",
      "/api/audio",
      "/assets/app.js",
      "/brand/logo.svg",
      "/images/art.png",
      "/art.png",
      "/missing.css",
    ])
      expect(pattern.test(path)).toBe(false);
  });
});
