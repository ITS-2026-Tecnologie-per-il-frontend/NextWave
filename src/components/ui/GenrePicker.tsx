export function GenrePicker({
  genres,
  selected,
  onChange,
}: {
  genres: string[];
  selected: string[];
  onChange: (genres: string[]) => void;
}) {
  return (
    <div>
      <p className="hint" role="status">
        {selected.length}/5 generi scelti. Seleziona da 1 a 5 preferenze.
      </p>
      <div className="chips">
        {genres.map((genre) => (
          <button
            key={genre}
            type="button"
            className={`chip ${selected.includes(genre) ? "selected" : ""}`}
            aria-pressed={selected.includes(genre)}
            disabled={!selected.includes(genre) && selected.length >= 5}
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
    </div>
  );
}
