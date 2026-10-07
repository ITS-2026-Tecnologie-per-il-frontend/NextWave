export function Brand({ onHome }: { onHome?: () => void }) {
  const content = (
    <>
      <picture>
        <source
          media="(max-width: 760px)"
          srcSet="/brand/nextwave-symbol.svg"
        />
        <img
          className="brand-image"
          src="/brand/nextwave-full.svg"
          alt="NextWave"
          width="439"
          height="369"
        />
      </picture>
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
    <div className="brand">{content}</div>
  );
}
