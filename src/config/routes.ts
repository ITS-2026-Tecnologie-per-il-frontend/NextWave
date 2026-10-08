import type { Route } from "../types/models.ts";
export const routePaths: Record<Route, string> = {
  daily: "/daily",
  ranks: "/ranks",
  artist: "/artist",
  profile: "/profile",
  admin: "/admin",
};

export function routeForPath(pathname: string): Route {
  return (
    (Object.keys(routePaths) as Route[]).find(
      (route) => routePaths[route] === pathname.replace(/\/$/, ""),
    ) ?? "daily"
  );
}

// Migrazione dei soli vecchi link di pagina. I frammenti OAuth restano intatti.
export function migrateLegacyPageLink() {
  const route = location.hash.slice(1) as Route;
  if (Object.hasOwn(routePaths, route)) {
    history.replaceState(
      history.state,
      "",
      routePaths[route] + location.search,
    );
  }
}
