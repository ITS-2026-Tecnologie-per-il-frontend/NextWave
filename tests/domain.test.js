import { test, expect } from "vitest";
import { catalog } from "../src/data/catalog.js";
import {
  canPlay,
  completeTrack,
  canVote,
  dailyRanking,
  rankRows,
} from "../src/domain/core.js";
import { normalizeProfile, createProfile } from "../src/services/storage.js";
import { validateApplication } from "../src/domain/applications.js";
const ids = catalog.slice(0, 5).map((track) => track.id);
test("la migrazione conserva profilo, selezione e voto ma non tratta avvii vecchi come completamenti", () => {
  const profile = normalizeProfile({
    ...createProfile(),
    rounds: { "2026-09-28": { ids, listened: ids, vote: ids[0] } },
  });
  expect(profile.rounds["2026-09-28"].ids).toEqual(ids);
  expect(profile.rounds["2026-09-28"].vote).toBe(ids[0]);
  expect(profile.rounds["2026-09-28"].listened).toEqual([]);
});
test("regole impediscono salti, ID esterni e voto senza cinque candidati", () => {
  const round = { ids, listened: [], vote: null };
  expect(canPlay(round, ids[1])).toBe(false);
  expect(canPlay(round, "unknown")).toBe(false);
  expect(completeTrack(round, ids[1])).toBe(round);
  expect(completeTrack(round, ids[0]).listened).toEqual([ids[0]]);
  expect(canVote({ ids: [], listened: [], vote: null }, false)).toBe(false);
});
test("classifica giornaliera include esposizioni e voto locale nello stesso punteggio del reveal", () => {
  const day = "2026-09-28";
  const base = rankRows(catalog, "day", day).find(
    (track) => track.id === ids[0],
  );
  const actual = dailyRanking(day, { [day]: { ids, vote: ids[0] } }).find(
    (track) => track.id === ids[0],
  );
  expect(actual.votes).toBe(base.votes + 1);
  expect(actual.exposures).toBe(base.exposures + 1);
  expect(actual.score).toBe(actual.votes / actual.exposures);
});
test("candidature: diritti, soglia, link al brano e duplicati anche localizzati", () => {
  const data = {
    artist: "Artista",
    title: "Brano",
    listeners: "500",
    subgenre: "Pop",
    rights: "on",
    spotify: "https://open.spotify.com/track/1234567890123456789012",
  };
  expect(validateApplication(data, [])).toBe("");
  expect(validateApplication({ ...data, listeners: "10000" }, [])).not.toBe("");
  expect(validateApplication({ ...data, rights: "" }, [])).not.toBe("");
  expect(
    validateApplication(
      { ...data, spotify: "https://example.com/track/1234567890123456789012" },
      [],
    ),
  ).not.toBe("");
  expect(
    validateApplication(
      {
        ...data,
        spotify:
          "https://open.spotify.com/intl-it/track/1234567890123456789012",
      },
      [data],
    ),
  ).toContain("già");
});
