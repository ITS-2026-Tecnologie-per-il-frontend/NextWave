import type { ReactElement } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { routePaths } from "../../config/routes.ts";

interface AccountRoutesProps {
  layout: ReactElement;
  daily: ReactElement;
  ranks: ReactElement;
  profile: ReactElement;
  artist: ReactElement;
  isArtist: boolean;
  admin?: ReactElement;
  canAdmin?: boolean;
}

export function AccountRoutes({
  layout,
  daily,
  ranks,
  profile,
  artist,
  isArtist,
  admin,
  canAdmin = false,
}: AccountRoutesProps) {
  return (
    <Routes>
      <Route element={layout}>
        <Route index element={<Navigate to={routePaths.daily} replace />} />
        <Route path={routePaths.daily} element={daily} />
        <Route path={routePaths.ranks} element={ranks} />
        <Route path={routePaths.profile} element={profile} />
        <Route
          path={routePaths.artist}
          element={
            isArtist ? artist : <Navigate to={routePaths.profile} replace />
          }
        />
        <Route
          path={routePaths.admin}
          element={
            canAdmin && admin ? (
              admin
            ) : (
              <Navigate to={routePaths.daily} replace />
            )
          }
        />
        <Route
          path="*"
          element={
            <section className="panel">
              <h1>Pagina non trovata</h1>
              <p>Questo indirizzo non corrisponde a una pagina di NextWave.</p>
              <Link className="btn" to={routePaths.daily}>
                Torna ai tuoi brani
              </Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
