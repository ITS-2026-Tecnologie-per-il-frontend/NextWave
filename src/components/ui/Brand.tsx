export function Brand({ onHome }: { onHome?: () => void }) {
  const content = (
    <>
      <span className="logo" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      vibe<span>pulse</span>
    </>
  );
  return onHome ? (
    <button
      type="button"
      className="brand brand-home"
      onClick={onHome}
      aria-label="Vibe Pulse · Torna ai 5 brani"
    >
      {content}
    </button>
  ) : (
    <div className="brand">{content}</div>
  );
}
