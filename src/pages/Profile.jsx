import { useState } from "react";
import { catalog, genres } from "../data/catalog.js";
import { themes } from "../data/themes.js";
import { GenrePicker, Heading } from "../components/ui.jsx";
export default function Profile({
  profile,
  onUpdate,
  onSave,
  notify,
  tracks = catalog,
  cloud = false,
  onSignOut,
  busy = false,
}) {
  const [name, setName] = useState(profile.name);
  const [preferences, setPreferences] = useState(profile.prefs);
  const [error, setError] = useState("");
  const rounds = Object.values(profile.rounds);
  const votes = rounds.filter((round) => round.vote);
  const selectedTheme =
    themes.find((theme) => theme.id === profile.theme) || themes[0];
  async function submit(event) {
    event.preventDefault();
    if (!preferences.length) {
      setError("Scegli almeno un genere.");
      return;
    }
    try {
      await onUpdate({
        name: name.trim() || "Ascoltatore",
        prefs: preferences,
      });
      setError("");
      notify("Preferenze salvate per domani.");
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <>
      <Heading title="Il tuo spazio">
        Le tue scelte danno spazio a nuove voci.
      </Heading>
      <div className="panel">
        <div className="row">
          <div className="user">
            <div className="avatar">
              {(profile.name || "Tu")[0].toUpperCase()}
            </div>
            <div>
              <h3>{profile.name || "Ascoltatore"}</h3>
              <span className="hint">
                {cloud ? "Account sincronizzato" : "Profilo demo locale"}
              </span>
            </div>
          </div>
          {cloud && (
            <button
              className="btn secondary small"
              disabled={busy}
              onClick={onSignOut}
            >
              Esci dall’account
            </button>
          )}
        </div>
      </div>
      <div className="statgrid">
        {[
          [votes.length, "Voti espressi"],
          [
            rounds.reduce((count, round) => count + round.listened.length, 0),
            "Brani completati",
          ],
          [profile.saved.length, "Scoperte salvate"],
        ].map(([count, label]) => (
          <div className="panel" key={label}>
            <strong>{count}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <section className="panel theme-panel" aria-labelledby="theme-heading">
        <div className="theme-heading">
          <div>
            <span className="eyebrow lime">CAMBIA ATMOSFERA</span>
            <h3 id="theme-heading">
              Il tuo stile<span className="lime">.</span>
            </h3>
          </div>
          <span className="theme-current">
            In uso: <strong>{selectedTheme.name}</strong>
          </span>
        </div>
        <p className="hint">
          Cinque palette, cinque modi di sentire la musica.
        </p>
        <div
          className="theme-catalog"
          role="group"
          aria-label="Scegli i colori di Vibe Pulse"
        >
          {themes.map((theme, index) => (
            <button
              key={theme.id}
              type="button"
              disabled={busy}
              className="theme-choice"
              data-palette={theme.id}
              aria-pressed={selectedTheme.id === theme.id}
              aria-label={`${theme.name}: ${theme.colors}`}
              onClick={() => onUpdate({ theme: theme.id })}
            >
              <span className="theme-art" aria-hidden="true">
                <span className="theme-number">0{index + 1}</span>
                <span className="theme-vinyl" />
                <span className="theme-wave">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span className="theme-details">
                <strong className="theme-name">{theme.name}</strong>
                <span className="theme-mood">{theme.mood}</span>
                <span className="theme-swatches" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="theme-colors">{theme.colors}</span>
                <span className="theme-status">
                  {selectedTheme.id === theme.id ? "✓ In uso" : "Scegli"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="panel">
        <h3>I tuoi gusti, la tua selezione</h3>
        <p className="hint">I cambiamenti valgono dalla selezione di domani.</p>
        <form onSubmit={submit}>
          <label>
            Nome
            <input
              maxLength="35"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <GenrePicker
            genres={genres}
            selected={preferences}
            onChange={setPreferences}
          />
          <button className="btn small" disabled={busy}>
            Salva preferenze
          </button>
          <span className="error" role="alert">
            {error}
          </span>
        </form>
      </div>
      <h2>Le tue scoperte</h2>
      <div className="savedlist">
        {profile.saved.length ? (
          profile.saved.map((id) => {
            const track = tracks.find((item) => item.id === id);
            return (
              <div key={id} className="panel">
                <b>{track.title}</b>
                <p className="hint">
                  {track.artist} · {track.genre}
                </p>
                <button className="textbtn" onClick={() => onSave(id)}>
                  Rimuovi dai salvati
                </button>
              </div>
            );
          })
        ) : (
          <p>Le scoperte che salvi dopo il reveal appariranno qui.</p>
        )}
      </div>
      <h2>Il tuo diario di ascolto</h2>
      {votes.length ? (
        votes.map((round) => (
          <div className="historyitem" key={round.day}>
            {round.day} · Voto registrato per il brano{" "}
            {round.ids.indexOf(round.vote) + 1} · {round.listened.length}/5
            completati
          </div>
        ))
      ) : (
        <p>Il tuo primo voto è ancora da scrivere.</p>
      )}
    </>
  );
}
