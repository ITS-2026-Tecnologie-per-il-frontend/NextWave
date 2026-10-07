import type { CSSProperties, ReactNode } from "react";
import type { Profile, Route, Player, Round } from "../types/models.ts";
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
import { Brand } from "./ui/Brand.tsx";
import { Icon } from "./ui/Icon.tsx";
const navigation: [Route, string][] = [
  ["daily", "Daily wave"],
  ["ranks", "Classifiche"],
  ["artist", "Per gli artisti"],
  ["profile", "Il tuo profilo"],
];
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
  const initial = (profile.name || "Tu")[0].toUpperCase();
  const trackIndex = player.active ? round.ids.indexOf(player.active) : -1;
  return (
    <>
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
              <button
                key={id}
                className={route === id ? "active" : ""}
                aria-current={route === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon name={id} />
                {label}
              </button>
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
          <div className="user">
            <button
              className="avatar"
              aria-label="Apri il tuo profilo"
              onClick={() => navigate("profile")}
            >
              {initial}
            </button>
            <div>
              {profile.name || "Ascoltatore"}
              <br />
              <span className="muted">
                {cloud ? "Account Next Wave" : "Profilo demo"}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
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
              <img
                className="topbar-logo"
                src="/brand/nextwave-symbol.svg"
                alt=""
                width="46"
                height="34"
              />
              <div className="header-wordmark" aria-hidden="true">
                Next<span>Wave</span>
                {!cloud && <small>Demo interattiva</small>}
              </div>
            </div>
            <button
              className="avatar"
              aria-label="Apri profilo"
              onClick={() => navigate("profile")}
            >
              {initial}
            </button>
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
      <section className="player" aria-label="Player musicale">
        <div className="playerinfo">
          <strong>
            {player.active
              ? revealed
                ? player.track?.title
                : `Brano ${String(trackIndex + 1).padStart(2, "0")}`
              : "Pronto a scoprire?"}
          </strong>
          <span>
            {player.active
              ? `${player.track?.genre} · ${!cloud || player.track?.isDemo ? "Audio demo" : "Audio"}`
              : "Ascolta ogni brano fino alla fine"}
          </span>
        </div>
        <button
          disabled={!round.ids.length || player.loading || (cloud && revealed)}
          onClick={() => player.play(player.active || round.ids[0])}
          aria-label={player.playing ? "Pausa" : "Riproduci"}
        >
          <Icon name={player.playing ? "pause" : "play"} />
        </button>
        <progress
          value={player.time}
          max={player.duration || 1}
          aria-label="Avanzamento brano"
        />
        <span className="time">
          {Math.floor(player.time)} / {Math.ceil(player.duration)} s
        </span>
        <label className="volume">
          Volume
          <input
            type="range"
            style={{ "--volume": `${player.volume * 100}%` } as CSSProperties}
            min="0"
            max="1"
            step="0.05"
            value={player.volume}
            onChange={(event) => player.setVolume(Number(event.target.value))}
          />
        </label>
      </section>
    </>
  );
}
