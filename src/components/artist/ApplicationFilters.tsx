import type { Application } from "../../types/models.ts";
import { rome } from "../../domain/shared/time.ts";

export const emptyApplicationFilters = {
  artist: "",
  title: "",
  date: "",
  dateType: "submitted",
};
export type ApplicationFilterValues = typeof emptyApplicationFilters;
export function matchesApplication(
  application: Application,
  filters: ApplicationFilterValues,
) {
  const includes = (value: string, query: string) =>
    value
      .toLocaleLowerCase("it")
      .includes(query.trim().toLocaleLowerCase("it"));
  const timestamp = application.submittedAt || application.created;
  const day =
    filters.dateType === "contest"
      ? application.contestDay
      : timestamp && Number.isFinite(Date.parse(timestamp))
        ? rome(new Date(timestamp)).day
        : undefined;
  return (
    includes(application.artist, filters.artist) &&
    includes(application.title, filters.title) &&
    (!filters.date || day === filters.date)
  );
}
export function ApplicationFilters({
  value,
  onChange,
}: {
  value: ApplicationFilterValues;
  onChange: (value: ApplicationFilterValues) => void;
}) {
  return (
    <div
      className="application-filters"
      role="group"
      aria-label="Filtra candidature"
    >
      <label>
        Filtra per artista
        <input
          type="search"
          placeholder="Cerca artista"
          value={value.artist}
          onChange={(event) =>
            onChange({ ...value, artist: event.target.value })
          }
        />
      </label>
      <label>
        Filtra per brano
        <input
          type="search"
          placeholder="Cerca brano"
          value={value.title}
          onChange={(event) =>
            onChange({ ...value, title: event.target.value })
          }
        />
      </label>
      <label>
        Tipo di data
        <select
          value={value.dateType}
          onChange={(event) =>
            onChange({ ...value, dateType: event.target.value })
          }
        >
          <option value="submitted">Data di invio</option>
          <option value="contest">Data del contest</option>
        </select>
      </label>
      <label>
        {value.dateType === "contest" ? "Data del contest" : "Data di invio"}
        <input
          type="date"
          value={value.date}
          onChange={(event) => onChange({ ...value, date: event.target.value })}
        />
      </label>
      <button
        type="button"
        className="btn secondary small"
        disabled={!value.artist && !value.title && !value.date}
        onClick={() => onChange({ ...emptyApplicationFilters })}
      >
        Azzera filtri
      </button>
    </div>
  );
}
