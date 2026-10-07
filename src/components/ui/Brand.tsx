export function Brand({ onHome }: { onHome?: () => void }) {
  const content = (
    <>
      <picture className="brand-picture">
        <source media="(max-width: 760px)" srcSet="/nextwave_senzanome.svg" />
        <img
          className="brand-logo"
          src="/nextwave_connome.svg"
          alt="Next Wave"
          width="439"
          height="369"
        />
      </picture>
      <span className="brand-mobile-name" aria-hidden="true">
        next<span>wave</span>
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
