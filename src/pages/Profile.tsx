import { getErrorMessage } from "../domain/errors.ts";
import { SpotifyLink } from "../components/ui/SpotifyLink.tsx";
import type { FormEvent } from "react";
import type { Profile, ProfileUpdate, Notify, Track } from "../types/models.ts";
interface ProfileProps {
  profile: Profile;
  onUpdate: ProfileUpdate;
  onSave: (id: string) => void;
  notify: Notify;
  tracks?: Track[];
  cloud?: boolean;
  onSignOut?: () => void;
  busy?: boolean;
  onAvatarUpload?: (file: File) => Promise<unknown>;
  onAvatarRemove?: () => Promise<unknown>;
}
import { useState } from "react";
import { catalog } from "../data/demo/catalog.ts";
import { genres } from "../data/genres.ts";
import { themes } from "../data/themes.ts";
import { GenrePicker } from "../components/ui/GenrePicker.tsx";
import { Heading } from "../components/ui/Heading.tsx";
import { Avatar } from "../components/ui/Avatar.tsx";
import AvatarCropDialog from "../components/ui/AvatarCropDialog.tsx";
export default function Profile({
  profile,
  onUpdate,
  onSave,
  notify,
  tracks = catalog,
  cloud = false,
  onSignOut,
  busy = false,
  onAvatarUpload,
  onAvatarRemove,
}: ProfileProps) {
  const [name, setName] = useState(profile.name);
  const [preferences, setPreferences] = useState(profile.prefs);
  const [error, setError] = useState("");
  const [changingType, setChangingType] = useState(false);
  const [typeError, setTypeError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  async function removeAvatar() {
    if (!onAvatarRemove) return;
    setAvatarBusy(true);
    try {
      await onAvatarRemove();
      setAvatarError("");
      notify("Immagine profilo rimossa.");
    } catch (error) {
      setAvatarError(getErrorMessage(error));
    } finally {
      setAvatarBusy(false);
    }
  }
  async function confirmAvatar(file: File) {
    if (!onAvatarUpload) return;
    setAvatarBusy(true);
    try {
      await onAvatarUpload(file);
      setCropFile(null);
      setAvatarError("");
      notify("Immagine profilo aggiornata.");
    } catch (error) {
      setAvatarError(getErrorMessage(error));
    } finally {
      setAvatarBusy(false);
    }
  }
  async function changeType(accountType: "listener" | "artist") {
    setChangingType(true);
    try {
      await onUpdate({ accountType });
      setTypeError("");
      notify(
        accountType === "artist"
          ? "Profilo artista attivato. Puoi accedere alla sezione artisti."
          : "Profilo ascoltatore attivato.",
      );
    } catch (error) {
      setTypeError(getErrorMessage(error));
    } finally {
      setChangingType(false);
    }
  }
  const rounds = Object.values(profile.rounds);
  const votes = rounds.filter((round) => round.vote);
  const selectedTheme =
    themes.find((theme) => theme.id === profile.theme) || themes[0];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences.length || preferences.length > 5) {
      setError("Scegli da 1 a 5 generi.");
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
      setError(getErrorMessage(error));
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
            <Avatar name={profile.name} imageUrl={profile.avatarUrl} />
            <div>
              <h3>{profile.name || "Ascoltatore"}</h3>
              <span className="hint">
                {cloud ? "Account sincronizzato" : "Profilo demo locale"}
              </span>
            </div>
          </div>
          {cloud && (
            <div className="profile-actions">
              {onAvatarUpload && (
                <button
                  className="btn secondary small"
                  type="button"
                  disabled={busy || avatarBusy}
                  aria-expanded={avatarEditorOpen}
                  onClick={() => setAvatarEditorOpen((open) => !open)}
                >
                  {avatarEditorOpen ? "Chiudi personalizzazione" : "Personalizza immagine"}
                </button>
              )}
              <button
                className="btn secondary small"
                disabled={busy}
                onClick={onSignOut}
              >
                Esci dall’account
              </button>
            </div>
          )}
        </div>
        {cloud && onAvatarUpload && avatarEditorOpen && (
          <div className="avatar-editor">
            <div className="avatar-editor-preview">
              <Avatar
                name={profile.name}
                imageUrl={profile.avatarUrl}
              />
            </div>
            <div className="avatar-editor-copy">
              <div className="avatar-editor-title">
                <strong>Immagine profilo</strong>
                <span className="avatar-editor-badge">PERSONALIZZA</span>
              </div>
              <span className="hint">
                Scegli un’immagine che ti rappresenta. Verrà mostrata nel menu
                e nella barra superiore.
              </span>
              <div className="avatar-controls">
                <label className="btn small avatar-upload">
                  {avatarBusy ? "Caricamento…" : "Carica immagine"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={busy || avatarBusy}
                    onChange={(event) => {
                      setCropFile(event.target.files?.[0] || null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {profile.avatarUrl && onAvatarRemove && (
                  <button
                    className="textbtn"
                    type="button"
                    disabled={busy || avatarBusy}
                    onClick={() => void removeAvatar()}
                  >
                    Rimuovi immagine
                  </button>
                )}
              </div>
              <span className="hint avatar-format">
                JPG, PNG, WebP o GIF · massimo 5 MB
              </span>
              {avatarError && (
                <span className="error" role="alert">
                  {avatarError}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      {cropFile && (
        <AvatarCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={confirmAvatar}
        />
      )}
      <section className="panel" aria-labelledby="account-type-heading">
        <h3 id="account-type-heading">Tipo di profilo</h3>
        <p className="hint">
          Come vuoi vivere Next Wave? Il profilo artista include anche ascolti e
          voti. Le candidature inviate restano conservate quando cambi tipo.
        </p>
        <div
          className="chips"
          role="group"
          aria-label="Scegli il tipo di profilo"
        >
          {(
            [
              ["listener", "Ascoltatore"],
              ["artist", "Artista"],
            ] as const
          ).map(([type, label]) => (
            <button
              type="button"
              key={type}
              className={`chip ${(profile.accountType ?? "listener") === type ? "selected" : ""}`}
              aria-pressed={(profile.accountType ?? "listener") === type}
              disabled={busy || changingType}
              onClick={() => void changeType(type)}
            >
              {label}
            </button>
          ))}
        </div>
        {typeError && (
          <p className="error" role="alert">
            {typeError}
          </p>
        )}
      </section>
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
          aria-label="Scegli i colori di Next Wave"
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
              maxLength={35}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <GenrePicker
            genres={genres}
            selected={preferences}
            onChange={setPreferences}
          />
          <button
            className="btn small"
            disabled={busy || !preferences.length || preferences.length > 5}
          >
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
            if (!track) return null;
            return (
              <div key={id} className="panel">
                <b>{track.title}</b>
                <p className="hint">
                  {track.artist} · {track.genre}
                </p>
                <button className="textbtn" onClick={() => onSave(id)}>
                  Rimuovi dai salvati
                </button>
                <SpotifyLink track={track} />
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
            {round.ids.indexOf(round.vote ?? "") + 1} · {round.listened.length}
            /5 completati
          </div>
        ))
      ) : (
        <p>Il tuo primo voto è ancora da scrivere.</p>
      )}
    </>
  );
}
