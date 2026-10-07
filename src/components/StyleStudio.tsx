import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  originalStyle,
  readCustomStyle,
  saveCustomStyle,
  styleVariables,
  type CustomStyle,
} from "../services/customStyle.ts";

const gradients = [
  { name: "Aurora", start: "#322345", end: "#173d42" },
  { name: "Blu notte", start: "#28375a", end: "#22223e" },
  { name: "Corallo", start: "#572e42", end: "#3e294c" },
];
export function StyleStudio({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState(() => readCustomStyle().style);
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [previewPeriod, setPreviewPeriod] = useState("day");
  const [previewVolume, setPreviewVolume] = useState(0.65);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  const change = (patch: Partial<CustomStyle>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setCompare(false);
  };
  const colorControl = (
    key: "background" | "backgroundEnd" | "cardStart" | "cardEnd" | "buttons",
    label: string,
    hint?: string,
  ) => (
    <label className="studio-color" key={key}>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input
        aria-label={label}
        type="color"
        value={draft[key]}
        onChange={(event) => change({ [key]: event.target.value })}
      />
      <code aria-hidden="true">{draft[key]}</code>
    </label>
  );
  return (
    <dialog
      className="style-studio"
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="studio-title"
    >
      <header className="studio-heading">
        <div>
          <small>IL TUO SPAZIO CREATIVO</small>
          <h2 id="studio-title">NextWave, a modo tuo.</h2>
          <p>
            Ogni controllo ha il suo spazio. Il risultato cambia qui, in tempo
            reale.
          </p>
        </div>
        <button
          autoFocus
          onClick={onClose}
          aria-label="Chiudi personalizzazione"
        >
          ✕
        </button>
      </header>
      <div className="studio-grid">
        <section className="studio-controls" aria-label="Controlli dello stile">
          <fieldset>
            <legend>01 · Sfumatura dello sfondo</legend>
            <p className="studio-help">
              Due colori per l’atmosfera della pagina. I campi di scrittura
              restano invariati.
            </p>
            {colorControl("background", "Sfondo: primo colore")}
            {colorControl("backgroundEnd", "Sfondo: secondo colore")}
          </fieldset>
          <fieldset>
            <legend>02 · Sfumatura delle schede</legend>
            <p className="studio-help">
              Due colori per schede, riquadri e copertine.
            </p>
            <div
              className="studio-gradients"
              role="group"
              aria-label="Sfumature di partenza"
            >
              {gradients.map((g) => (
                <button
                  key={g.name}
                  onClick={() => change({ cardStart: g.start, cardEnd: g.end })}
                  aria-label={`Sfumatura ${g.name}`}
                  title={g.name}
                  style={{
                    background: `linear-gradient(135deg, ${g.start}, ${g.end})`,
                  }}
                >
                  {g.name}
                </button>
              ))}
            </div>
            {colorControl("cardStart", "Primo colore")}
            {colorControl("cardEnd", "Secondo colore")}
          </fieldset>
          <fieldset>
            <legend>03 · Pulsanti e collegamenti</legend>
            {colorControl(
              "buttons",
              "Pulsanti e selezioni",
              "Il colore scelto per tasti, collegamenti e voci attive.",
            )}
            <p className="studio-help">
              Volume e avanzamento riprendono questo colore: se è troppo scuro,
              si schiarisce solo la barra per restare visibile.
            </p>
          </fieldset>
          <fieldset>
            <legend>04 · Forma e carattere</legend>
            <label>
              Angoli delle schede <output>{draft.radius}px</output>
              <input
                aria-label="Angoli delle schede"
                type="range"
                min="0"
                max="32"
                value={draft.radius}
                onChange={(event) =>
                  change({ radius: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Ombra delle schede <output>{draft.shadow}</output>
              <input
                aria-label="Ombra delle schede"
                type="range"
                min="0"
                max="30"
                value={draft.shadow}
                onChange={(event) =>
                  change({ shadow: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Font dell’interfaccia
              <select
                value={draft.font}
                onChange={(event) => change({ font: event.target.value })}
              >
                <option>Space Grotesk</option>
                <option>Arial</option>
                <option>Georgia</option>
              </select>
            </label>
          </fieldset>
          <button
            className="textbtn"
            onClick={() => change({ ...originalStyle })}
          >
            Riparti dall’originale
          </button>
        </section>
        <section
          className="studio-preview-area"
          aria-label="Anteprima del tuo stile"
        >
          <div className="studio-preview-label">
            <small>
              {compare ? "STILE DI PARTENZA" : "ANTEPRIMA IN TEMPO REALE"}
            </small>
            <button aria-pressed={compare} onClick={() => setCompare(!compare)}>
              {compare ? "Mostra le modifiche" : "Confronta con originale"}
            </button>
          </div>
          <div
            className="custom-preview"
            style={
              styleVariables(compare ? originalStyle : draft) as CSSProperties
            }
          >
            <div className="preview-topbar">
              <div className="preview-brand">
                <img src="/brand/nextwave-symbol.svg" alt="" />
                <strong>
                  Next<span>Wave</span>
                </strong>
              </div>
              <span className="avatar" aria-label="Avatar invariato">
                A
              </span>
            </div>
            <div className="preview-content">
              <h2>Il tuo daily wave.</h2>
              <p>Cinque brani. Un voto. La tua atmosfera.</p>
              <div className="preview-tabs" aria-label="Esempio di navigazione">
                <span className="active">Daily wave</span>
                <span>Classifiche</span>
                <span>Profilo</span>
              </div>
              <div
                className="ranktabs"
                role="group"
                aria-label="Periodo nell’anteprima"
              >
                {(
                  [
                    ["day", "Giornaliera"],
                    ["week", "Settimanale"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={previewPeriod === value ? "active" : ""}
                    aria-pressed={previewPeriod === value}
                    onClick={() => setPreviewPeriod(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="preview-cards">
                {["01", "02", "03"].map((n) => (
                  <article className="track" key={n}>
                    <div className="preview-cover">
                      {n}
                      <span>♪</span>
                    </div>
                    <h3>Brano {n}</h3>
                    <p>Una nuova scoperta</p>
                    <button className="btn" disabled>
                      Ascolta
                    </button>
                  </article>
                ))}
              </div>
              <div className="panel preview-form">
                <label>
                  Il tuo nome
                  <input
                    type="text"
                    value={previewName}
                    onChange={(event) => setPreviewName(event.target.value)}
                    placeholder="Prova a scrivere qui"
                    autoComplete="off"
                    maxLength={35}
                  />
                </label>
                <p>
                  Campo di scrittura sempre uguale, anche quando cambi sfondo.
                </p>
                <button className="textbtn" disabled>
                  Candida un brano ↗
                </button>
              </div>
            </div>
            <div className="preview-player">
              <span className="preview-play">▶</span>
              <div>
                <strong>Pronto a scoprire?</strong>
                <p>Il player resta sempre leggibile.</p>
              </div>
              <progress
                className="preview-progress"
                value={38}
                max={100}
                aria-label="Anteprima avanzamento"
              />
              <label className="preview-volume">
                Volume
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={previewVolume}
                  style={
                    { "--volume": `${previewVolume * 100}%` } as CSSProperties
                  }
                  onChange={(event) =>
                    setPreviewVolume(Number(event.target.value))
                  }
                />
              </label>
            </div>
          </div>
          <p className="studio-note">
            Logo, avatar e campi di scrittura mantengono il loro aspetto. Testi
            e sfumature si adattano per restare leggibili, anche sui colori più
            chiari.
          </p>
        </section>
      </div>
      <footer className="studio-footer">
        <p>
          Lo stile viene salvato in questo browser. Nessuna modifica finché non
          premi Applica.
        </p>
        <div>
          <button onClick={onClose}>Annulla</button>
          <button
            className="btn"
            onClick={() => {
              try {
                saveCustomStyle(draft, true);
                onClose();
              } catch {
                setError("Il browser non consente di salvare lo stile.");
              }
            }}
          >
            Applica il mio stile
          </button>
        </div>
      </footer>
      {error && <p role="alert">{error}</p>}
    </dialog>
  );
}
