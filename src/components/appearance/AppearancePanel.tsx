import { useEffect, useRef, useState } from "react";
import { defaultTheme, themes } from "../../data/themes.ts";
import { useCustomStyle } from "../../hooks/useCustomStyle.ts";
import {
  type CustomStyle,
  type SavedStyle,
} from "../../services/appearance/customStyle.ts";
import { StyleStudio } from "./StyleStudio.tsx";
import { StyleThumbnail } from "./StyleThumbnail.tsx";

type EditingStyle = { style: CustomStyle; name: string; id?: string };

function StyleLibrary({
  styles,
  currentId,
  onClose,
  onApply,
  onEdit,
  onCreate,
}: {
  styles: SavedStyle[];
  currentId?: string;
  onClose: () => void;
  onApply: (item: SavedStyle) => void;
  onEdit: (item: SavedStyle) => void;
  onCreate: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      className="style-library"
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="library-title"
    >
      <header className="studio-heading">
        <div>
          <small>LA TUA COLLEZIONE</small>
          <h2 id="library-title">I tuoi stili</h2>
          <p>
            Salvati in questo browser. Riprendi una creazione o applicala
            subito.
          </p>
        </div>
        <button onClick={onClose} aria-label="Chiudi i tuoi stili" autoFocus>
          ✕
        </button>
      </header>
      {styles.length ? (
        <div className="saved-styles-grid">
          {styles.map((entry) => (
            <article className="saved-style" key={entry.id}>
              <StyleThumbnail style={entry.style} />
              <h3>{entry.name}</h3>
              <div className="saved-style-actions">
                <button className="btn small" onClick={() => onApply(entry)}>
                  {currentId === entry.id ? "✓ In uso" : "Applica"}
                </button>
                <button
                  className="btn secondary small"
                  onClick={() => onEdit(entry)}
                >
                  Modifica
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="library-empty">
          <h3>Il tuo primo stile parte da qui.</h3>
          <p>Scegli colori, sfumature e logo, poi salvali con un nome.</p>
          <button className="btn" onClick={onCreate}>
            Crea uno stile
          </button>
        </div>
      )}
    </dialog>
  );
}

export function AppearancePanel({ theme }: { theme: string }) {
  const fallback = defaultTheme(theme);
  const current = useCustomStyle();
  const [editor, setEditor] = useState<EditingStyle | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [error, setError] = useState("");
  const carousel = useRef<HTMLDivElement>(null);
  const saved = current.library.find(
    (item) => item.id === current.savedStyleId,
  );
  const presetId = current.active ? current.presetId : fallback.id;
  const preset = themes.find((item) => item.id === presetId);
  const currentName = saved?.name ?? preset?.name ?? "Il tuo stile";
  const editCurrent = () => {
    setLibraryOpen(false);
    setEditor({
      style: current.style,
      name:
        saved?.name ?? (preset ? `${preset.name} personale` : "Il mio stile"),
      id: saved?.id,
    });
  };
  const scroll = (direction: number) =>
    carousel.current?.scrollBy({
      left: direction * carousel.current.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  return (
    <>
      <section className="panel theme-panel" aria-labelledby="theme-heading">
        <div className="theme-heading">
          <div>
            <span className="eyebrow">CAMBIA ATMOSFERA</span>
            <h3 id="theme-heading">Il tuo stile.</h3>
          </div>
          <span className="theme-current">
            In uso: <strong>{currentName}</strong>
          </span>
        </div>
        <div className="theme-carousel-heading">
          <p>Dieci generi, dieci atmosfere. Scorri e trova la tua.</p>
          <div className="theme-carousel-arrows">
            <button aria-label="Stili precedenti" onClick={() => scroll(-1)}>
              ←
            </button>
            <button aria-label="Stili successivi" onClick={() => scroll(1)}>
              →
            </button>
          </div>
        </div>
        <div
          className="theme-catalog"
          ref={carousel}
          role="group"
          aria-label="Scegli lo stile di NextWave"
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                ".theme-choice",
              ),
            );
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (index < 0) return;
            event.preventDefault();
            buttons[
              Math.max(
                0,
                Math.min(
                  buttons.length - 1,
                  index + (event.key === "ArrowRight" ? 1 : -1),
                ),
              )
            ].focus();
          }}
        >
          {themes.map((item, index) => (
            <button
              className="theme-choice"
              key={item.id}
              aria-pressed={presetId === item.id}
              aria-label={`${item.name}: ${item.color}`}
              onClick={() => {
                try {
                  current.applyStyle(item.style, true, { presetId: item.id });
                  setError("");
                } catch {
                  setError("Il browser non consente di salvare lo stile.");
                }
              }}
            >
              <StyleThumbnail style={item.style} />
              <span className="theme-details">
                <span className="theme-card-title">
                  <strong>{item.name}</strong>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </span>
                <span className="theme-mood">{item.mood}</span>
                <span className="theme-palette">
                  <i style={{ background: item.color }} />
                  <code>{item.color}</code>
                  <span>{presetId === item.id ? "✓ In uso" : "Scegli →"}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="studio-launch">
          <div>
            <small>FATTO DA TE</small>
            <h3>La tua musica. La tua firma.</h3>
            <p>
              Parti da uno stile, rendilo tuo e salvalo nella tua collezione.
            </p>
          </div>
          <div className="studio-launch-actions">
            <button className="btn" onClick={editCurrent}>
              {current.active ? "Modifica il tuo stile" : "Crea il tuo stile"} ↗
            </button>
            <button
              className="btn secondary"
              onClick={() => setLibraryOpen(true)}
            >
              I tuoi stili <span>{current.library.length}</span>
            </button>
          </div>
        </div>
        <p className="style-storage-note">
          Gli stili personali restano salvati in questo browser.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      {editor && (
        <StyleStudio
          initialStyle={editor.style}
          initialName={editor.name}
          savedStyleId={editor.id}
          onClose={() => setEditor(null)}
        />
      )}
      {libraryOpen && (
        <StyleLibrary
          styles={current.library}
          currentId={current.savedStyleId}
          onClose={() => setLibraryOpen(false)}
          onCreate={editCurrent}
          onEdit={(item) => {
            setLibraryOpen(false);
            setEditor({ style: item.style, name: item.name, id: item.id });
          }}
          onApply={(item) => {
            try {
              current.applyStyle(item.style, true, { savedStyleId: item.id });
              setLibraryOpen(false);
              setError("");
            } catch {
              setLibraryOpen(false);
              setError("Il browser non consente di applicare lo stile.");
            }
          }}
        />
      )}
    </>
  );
}
