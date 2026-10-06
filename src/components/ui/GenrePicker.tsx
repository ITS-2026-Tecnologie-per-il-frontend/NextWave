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
