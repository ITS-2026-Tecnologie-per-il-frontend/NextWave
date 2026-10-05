const paths = {
  daily: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  ranks: <path d="M5 20V12M12 20V4M19 20V8" />,
  artist: (
    <>
      <path d="M9 18V5l12-2v13M9 7l12-2" />
      <ellipse cx="6" cy="18" rx="3" ry="3" />
      <ellipse cx="18" cy="16" rx="3" ry="3" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  play: <path d="m9 5 11 7-11 7z" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="4" />,
};
export function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.play}
    </svg>
  );
}
export function Brand({ onHome }) {
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
export function Heading({ title, children }) {
  return (
    <div className="heading">
      <div>
        <h1>
          {title}
          <span className="lime">.</span>
        </h1>
        <p>{children}</p>
      </div>
    </div>
  );
}
export function GenrePicker({ genres, selected, onChange }) {
  return (
    <div className="chips">
      {genres.map((genre) => (
        <button
          key={genre}
          type="button"
          className={`chip ${selected.includes(genre) ? "selected" : ""}`}
          aria-pressed={selected.includes(genre)}
          onClick={() =>
            onChange(
              selected.includes(genre)
                ? selected.filter((item) => item !== genre)
                : [...selected, genre],
            )
          }
        >
          {genre}
        </button>
      ))}
    </div>
  );
}
