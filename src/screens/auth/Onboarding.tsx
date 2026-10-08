import type { Profile, ProfileUpdate } from "../../types/models.ts";
interface OnboardingProps {
  profile: Profile;
  onFinish: ProfileUpdate;
  cloud?: boolean;
  busy?: boolean;
}
import { useState } from "react";
import { genres } from "../../data/genres.ts";
import { Brand } from "../../components/brand/Brand.tsx";
import { GenrePicker } from "../../components/ui/GenrePicker.tsx";
export default function Onboarding({
  profile,
  onFinish,
  cloud = false,
  busy = false,
}: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.name);
  const [preferences, setPreferences] = useState(profile.prefs);
  return (
    <div className="onboarding">
      <section className="visual">
        <img
          src="/images/art.png"
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
          {step + 1} / 2 — {["BENVENUTO IN NEXT WAVE", "I TUOI GUSTI"][step]}
        </span>
        <div
          className="onboarding-progress"
          aria-label={`Passaggio ${step + 1} di 2`}
        >
          <span className={step >= 0 ? "active" : ""} />
          <span className={step >= 1 ? "active" : ""} />
        </div>
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
              Entra in Next Wave →
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Che musica senti tua?</h1>
            <p>Scegli da 1 a 5 generi. La selezione di oggi partirà da qui.</p>
            {profile.prefs.length > 5 && (
              <p role="alert">
                Hai più di 5 preferenze: scegli quali mantenere per continuare.
              </p>
            )}
            <label>
              Come ti chiami?
              <input
                maxLength={35}
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
              disabled={!preferences.length || preferences.length > 5 || busy}
              onClick={() =>
                onFinish({
                  name: name.trim() || "Ascoltatore",
                  prefs: preferences,
                  onboard: true,
                })
              }
            >
              Scopri i tuoi 5 brani →
            </button>
            <button
              className="textbtn onboarding-back"
              type="button"
              disabled={busy}
              onClick={() => setStep(0)}
            >
              ← Torna indietro
            </button>
          </>
        )}
        <p className="hint">
          {cloud
            ? "I tuoi gusti saranno salvati nel tuo account."
            : "Artisti e audio dimostrativi · Gratuito, per tutti."}
        </p>
      </section>
    </div>
  );
}
