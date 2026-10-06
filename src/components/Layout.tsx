import type { ReactNode } from "react";
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
}
import { Brand } from "./ui/Brand.tsx";
import { Icon } from "./ui/Icon.tsx";
const navigation: [Route, string][] = [
  ["daily", "Daily pulse"],
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
}: LayoutProps) {
  const initial = (profile.name || "Tu")[0].toUpperCase();
  const trackIndex = player.active ? round.ids.indexOf(player.active) : -1;
  return (
    <>
      <aside className="sidebar">
        <Brand onHome={() => navigate("daily")} />
        <nav className="nav" aria-label="Navigazione principale">
          {navigation.map(([id, label]) => (
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
            <button className="textbtn" onClick={() => navigate("artist")}>
              Candida un brano ↗
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
                {cloud ? "Account Vibe Pulse" : "Profilo demo"}
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
            <span className="badge">
              {cloud ? "VIBE PULSE" : "DEMO INTERATTIVA"}
            </span>
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
          VIBE PULSE © 2026 ·{" "}
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
        <label>
          Volume
          <input
            type="range"
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
