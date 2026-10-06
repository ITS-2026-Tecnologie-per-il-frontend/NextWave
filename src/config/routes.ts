import type { Route } from "../types/models.ts";
// Le due modalità condividono le stesse pagine e gli stessi URL.
export const routes: Route[] = ["daily", "ranks", "artist", "profile"];

export function readRoute(hash = location.hash): Route {
  const route = hash.slice(1);
  return routes.find((allowed) => allowed === route) ?? "daily";
}
