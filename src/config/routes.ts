import type { Route } from "../types/models.ts";
// Le due modalità condividono le stesse pagine e gli stessi URL.
export const routes: Route[] = ["daily", "ranks", "artist", "profile", "admin"];

export function readRoute(hash = location.hash, allowAdmin = false): Route {
  const route = hash.slice(1);
  if (route === "admin" && !allowAdmin) return "daily";
  return routes.find((allowed) => allowed === route) ?? "daily";
}
