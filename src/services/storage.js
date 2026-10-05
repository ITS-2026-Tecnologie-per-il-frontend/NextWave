import { catalog, genres } from "../data/catalog.js";
import { selectTracks } from "../domain/core.js";
export const STORAGE_KEY = "vibepulse-v1";

export function createProfile() {
  return {
    uid: crypto.randomUUID(),
    name: "",
    prefs: ["Indie", "Pop", "Elettronica"],
    connected: false,
    onboard: false,
    rounds: {},
    saved: [],
    applications: [],
    seenReveals: [],
    theme: "pulse",
  };
}
export function normalizeProfile(value) {
  const initial = createProfile();
  if (!value || typeof value !== "object" || Array.isArray(value))
    return initial;
  const profile = { ...initial, ...value };
  profile.prefs = Array.isArray(value.prefs)
    ? value.prefs.filter((genre) => genres.includes(genre))
    : initial.prefs;
  if (!profile.prefs.length) profile.prefs = initial.prefs;
  profile.name = typeof value.name === "string" ? value.name : "";
  profile.uid = typeof value.uid === "string" ? value.uid : initial.uid;
  profile.rounds = {};
  for (const [day, round] of Object.entries(value.rounds || {})) {
    if (
      !Array.isArray(round?.ids) ||
      round.ids.length !== 5 ||
      new Set(round.ids).size !== 5 ||
      !round.ids.every((id) => catalog.some((track) => track.id === id))
    )
      continue;
    // I vecchi avvii non provano un ascolto completo. I voti già espressi restano nello storico.
    const listened =
      round.completionVersion === 2 && Array.isArray(round.listened)
        ? round.ids.filter((id) => round.listened.includes(id))
        : [];
    profile.rounds[day] = { ...round, day, listened, completionVersion: 2 };
  }
  profile.saved = Array.isArray(value.saved)
    ? value.saved.filter((id) => catalog.some((track) => track.id === id))
    : [];
  profile.applications = Array.isArray(value.applications)
    ? value.applications
    : [];
  profile.seenReveals = Array.isArray(value.seenReveals)
    ? value.seenReveals
    : [];
  return profile;
}
export function readProfile() {
  try {
    return normalizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return createProfile();
  }
}
export function ensureRound(profile, day) {
  if (profile.rounds[day]) return profile;
  const ids = selectTracks(catalog, profile.prefs, day + profile.uid);
  return {
    ...profile,
    rounds: {
      ...profile.rounds,
      [day]: { ids, listened: [], vote: null, day, completionVersion: 2 },
    },
  };
}
export function writeProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
