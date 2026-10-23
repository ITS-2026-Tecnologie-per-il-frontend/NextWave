import { useEffect, useRef, useState } from "react";
import Dialog from "./Dialog.tsx";

const storageKey = "nextwave:welcome:v1";
let dismissedThisSession = false;

export default function WelcomeGuide() {
  const heading = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(() => {
    if (dismissedThisSession) return false;
    try {
      return localStorage.getItem(storageKey) !== "seen";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (open) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest("dialog")?.scrollTo(0, 0);
    }
  }, [open]);

  function dismiss() {
    dismissedThisSession = true;
    try {
      localStorage.setItem(storageKey, "seen");
    } catch {
      // The guide remains dismissible when browser storage is unavailable.
    }
    setOpen(false);
  }

  if (!open) return null;
  return (
    <Dialog
      onClose={dismiss}
      className="welcome-guide"
      ariaLabel="Benvenuto su NextWave"
    >
      <span className="eyebrow lime">BENVENUTO SU NEXTWAVE</span>
      <h2 ref={heading} tabIndex={-1}>
        5 brani. Un voto. Ogni giorno.
      </h2>
      <p>Scopri nuovi artisti lasciandoti guidare dalla musica.</p>
      <ol className="welcome-steps">
        <li>
          <strong>Ascolta nella Daily</strong>
          <p>
            Quando il contest è disponibile, trovi 5 brani da ascoltare. Titoli
            e artisti restano nascosti fino alla rivelazione.
          </p>
        </li>
        <li>
          <strong>Scegli il tuo preferito</strong>
          <p>
            Completa tutti gli ascolti e assegna il tuo unico voto del giorno.
            Una volta confermato, non puoi cambiarlo.
          </p>
        </li>
        <li>
          <strong>Scopri chi hai ascoltato</strong>
          <p>
            Alle 21:00, ora italiana, si svelano artisti e risultati. In
            Classifica puoi esplorare le posizioni dei brani.
          </p>
        </li>
      </ol>
      <p className="welcome-extra">
        <strong>Fai musica?</strong> Con un profilo artista, il pannello Artisti
        ti permette di candidare un brano e seguirne lo stato. Nel Profilo puoi
        gestire preferenze e aspetto dell’app.
      </p>
      <button className="btn" onClick={dismiss}>
        Ho capito, iniziamo
      </button>
    </Dialog>
  );
}
