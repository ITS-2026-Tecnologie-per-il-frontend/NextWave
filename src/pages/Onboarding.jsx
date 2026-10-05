import { useState } from "react";
import { genres } from "../data/catalog.js";
import { Brand, GenrePicker } from "../components/ui.jsx";
export default function Onboarding({ profile, onFinish }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name);
  const [preferences, setPreferences] = useState(profile.prefs);
  const [connected, setConnected] = useState(profile.connected);
  return (
    <div className="onboarding">
      <section className="visual">
        <img
          src="/art.png"
          alt="Scultura sonora cromata con riflessi viola e lime"
        />
        <Brand />
        <h1>
          Prima la musica.
          <br />
          <span className="lime">Poi il nome.</span>
        </h1>
        <div className="bottom">
          <span className="eyebrow">IL TUO NUOVO RITUALE</span>
          <p>5 brani. Un voto. Ogni giorno.</p>
        </div>
      </section>
      <section className="onboardform">
        <span className="eyebrow lime">
          {step + 1} / 3 —{" "}
          {["BENVENUTO NEL PULSE", "LA TUA CONNESSIONE", "I TUOI GUSTI"][step]}
        </span>
        {step === 0 && (
          <>
            <h1>
              La prossima scoperta
              <br />
              inizia da te.
            </h1>
            <p>
              Ascolta cinque artisti emergenti, senza nome né numeri. Completa
              ogni brano per sbloccare il successivo.
            </p>
            <div className="steps">
              <div className="step">
                <span className="num">01</span>
                <b>Ascolta</b>5 audio al buio, fino alla fine
              </div>
              <div className="step">
                <span className="num">02</span>
                <b>Vota</b>Un solo preferito
              </div>
              <div className="step">
                <span className="num">03</span>
                <b>Scopri</b>Reveal alle 21:00
              </div>
            </div>
            <button className="btn" onClick={() => setStep(1)}>
              Entra nel pulse →
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>
              Porta i tuoi gusti.
              <br />
              Scopri nuove voci.
            </h1>
            <p>Spotify potrà affiancare le preferenze che scegli tu.</p>
            <div className="notice">
              Stai provando una demo: nessun accesso al tuo account e nessuna
              password richiesta.
            </div>
            <button
              className="btn"
              onClick={() => {
                setConnected(true);
                setStep(2);
              }}
            >
              Collega Spotify · simulazione
            </button>
            <button className="textbtn" onClick={() => setStep(2)}>
              Continua senza collegamento
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <h1>Che musica senti tua?</h1>
            <p>Scegli almeno un genere. La selezione di oggi partirà da qui.</p>
            <label>
              Come ti chiami?
              <input
                maxLength="35"
                placeholder="Il tuo nome"
                autoComplete="given-name"
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
              className="btn"
              disabled={!preferences.length}
              onClick={() =>
                onFinish({
                  name: name.trim() || "Ascoltatore",
                  prefs: preferences,
                  connected,
                  onboard: true,
                })
              }
            >
              Scopri i tuoi 5 brani →
            </button>
          </>
        )}
        <p className="hint">
          Artisti e audio dimostrativi · Gratuito, per tutti.
        </p>
      </section>
    </div>
  );
}
