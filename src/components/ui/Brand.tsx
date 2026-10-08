import { BrandLogo } from "./BrandLogo.tsx";
export function Brand({ onHome }: { onHome?: () => void }) {
  const content = (
    <>
      <BrandLogo variant="full" className="brand-image brand-full" />
      <BrandLogo className="brand-image brand-symbol" />
      <span className="brand-mobile-name" aria-hidden="true">
        Next<span>Wave</span>
      </span>
    </>
  );
  return onHome ? (
    <button
      type="button"
      className="brand brand-home"
      onClick={onHome}
      aria-label="Next Wave · Torna ai 5 brani"
    >
      {content}
    </button>
  ) : (
    <div className="brand" aria-label="NextWave">
      {content}
    </div>
  );
}
