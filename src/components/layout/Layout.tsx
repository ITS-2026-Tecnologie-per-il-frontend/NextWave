import { NavLink } from "react-router-dom";
import { routePaths } from "../../config/routes.ts";
import { useCustomStyle } from "../../hooks/useCustomStyle.ts";
import { defaultTheme } from "../../data/themes.ts";
import { AppearanceFilters } from "../appearance/AppearanceFilters.tsx";
import { BrandLogo } from "../brand/BrandLogo.tsx";
import type { ReactNode } from "react";
import type { Profile, Route, Player, Round } from "../../types/models.ts";
interface LayoutProps {
  profile: Profile;
  route: Route;
  navigate: (route: Route) => void;
  children: ReactNode;
  player: Player;
  revealed: boolean;
  round: Round;
  cloud?: boolean;
  admin?: boolean;
}
import { Brand } from "../brand/Brand.tsx";
import { Icon } from "../ui/Icon.tsx";
import { Avatar } from "../ui/Avatar.tsx";
import PlayerBar from "../playback/PlayerBar.tsx";
const navigation: [Route, string][] = [
  ["daily", "Daily wave"],
  ["ranks", "Classifiche"],
  ["artist", "Per gli artisti"],
  ["profile", "Il tuo profilo"],
];
const mobileLabels: Record<Route, string> = {
  daily: "Daily",
  ranks: "Classifica",
  artist: "Artisti",
  profile: "Profilo",
  admin: "Admin",
};
export default function Layout({
  profile,
  route,
  navigate,
  children,
  player,
  revealed,
  round,
  cloud = false,
  admin = false,
}: LayoutProps) {
  const appearance = useCustomStyle(true, defaultTheme(profile.theme).style);
  return (
    <>
      <AppearanceFilters style={appearance.style} id="nextwave-wave" />
      <aside className="sidebar">
        <Brand onHome={() => navigate("daily")} />
        <nav className="nav" aria-label="Navigazione principale">
          {(admin
            ? [...navigation, ["admin", "Pannello admin"] as [Route, string]]
            : navigation
          )
            .filter(
              ([id]) => id !== "artist" || profile.accountType === "artist",
            )
            .map(([id, label]) => (
              <NavLink
                key={id}
                to={routePaths[id]}
                end
                className={({ isActive }) => (isActive ? "active" : "")}
                aria-label={label}
              >
                <Icon name={id} />
                <span className="nav-label-desktop">{label}</span>
                <span className="nav-label-mobile" aria-hidden="true">
                  {mobileLabels[id]}
                </span>
              </NavLink>
            ))}
        </nav>
        <div className="sidefoot">
          <div className="minicard">
            <span className="lime">La tua musica merita ascolto.</span>
            <p>Meno di 10.000 ascoltatori? Questo è il tuo spazio.</p>
            <button
              className="textbtn"
              onClick={() =>
                navigate(
                  profile.accountType === "artist" ? "artist" : "profile",
                )
              }
            >
              {profile.accountType === "artist"
                ? "Candida un brano ↗"
                : "Attiva il profilo artista ↗"}
            </button>
          </div>
          <div className="account-card">
            <Avatar
              name={profile.name}
              imageUrl={profile.avatarUrl}
              button
              label="Apri il tuo profilo"
              onClick={() => navigate("profile")}
            />
            <div className="account-copy">
              <strong>{profile.name || "Ascoltatore"}</strong>
              <span className="account-meta">
                <i aria-hidden="true" />
                {profile.accountType === "artist" ? "Artista" : "Ascoltatore"}
              </span>
            </div>
            <button
              className="account-open"
              type="button"
              aria-label="Apri le impostazioni del profilo"
              onClick={() => navigate("profile")}
            >
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </aside>
      <main className={`main main-${route}`}>
        <header className="topbar">
          <span>La scoperta inizia dall’ascolto.</span>
          <div className="mobilebrand">
            <Brand onHome={() => navigate("daily")} />
          </div>
          <div className="topright">
            <div
              className="header-signature"
              aria-label={cloud ? "NextWave" : "NextWave · Demo interattiva"}
            >
              <BrandLogo className="topbar-logo" />
              <div className="header-wordmark" aria-hidden="true">
                Next<span>Wave</span>
                {!cloud && <small>Demo interattiva</small>}
              </div>
            </div>
            <Avatar
              name={profile.name}
              imageUrl={profile.avatarUrl}
              button
              label="Apri profilo"
              onClick={() => navigate("profile")}
            />
          </div>
        </header>
        {children}
        <p className="footerline">
          NEXT WAVE © 2026 ·{" "}
          {cloud
            ? "Account e progressi sincronizzati"
            : "Artisti, audio e risultati dimostrativi"}{" "}
          · Orario Europe/Rome
        </p>
      </main>
      <PlayerBar
        player={player}
        round={round}
        revealed={revealed}
        cloud={cloud}
      />
    </>
  );
}
