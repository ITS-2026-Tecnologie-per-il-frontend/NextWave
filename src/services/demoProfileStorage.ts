import { catalog } from "../data/demo/catalog.ts";
import { genres } from "../data/genres.ts";
import { selectTracks } from "../domain/selection.ts";
import type { Profile, Application } from "../types/models.ts";
export const STORAGE_KEY = "vibepulse-v1";

export function createProfile(): Profile {
  return {
    uid: crypto.randomUUID(),
    name: "",
    prefs: ["Indie", "Pop", "Elettronica"],
    onboard: false,
    rounds: {},
    saved: [],
    applications: [],
    seenReveals: [],
    theme: "pulse",
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isApplication(value: unknown): value is Application {
  return (
    isRecord(value) &&
    typeof value.artist === "string" &&
    typeof value.title === "string" &&
    (typeof value.listeners === "string" ||
      typeof value.listeners === "number") &&
    typeof value.subgenre === "string" &&
    typeof value.spotify === "string" &&
    ["genre", "language", "mood", "id", "created", "status"].every(
      (key) => value[key] === undefined || typeof value[key] === "string",
    ) &&
    (value.rights === undefined ||
      typeof value.rights === "string" ||
      typeof value.rights === "boolean")
  );
}

export function normalizeProfile(value: unknown): Profile {
  const initial = createProfile();
  if (!isRecord(value)) return initial;
  const profile: Profile = { ...initial };
  profile.prefs = Array.isArray(value.prefs)
    ? strings(value.prefs).filter((genre) => genres.includes(genre))
    : initial.prefs;
  if (!profile.prefs.length) profile.prefs = initial.prefs;
  profile.name = typeof value.name === "string" ? value.name : "";
  profile.uid = typeof value.uid === "string" ? value.uid : initial.uid;
  profile.onboard = value.onboard === true;
  profile.theme = typeof value.theme === "string" ? value.theme : initial.theme;
  profile.rounds = {};
  for (const [day, round] of Object.entries(
    isRecord(value.rounds) ? value.rounds : {},
  )) {
    if (!isRecord(round)) continue;
    const ids = strings(round.ids);
    if (
      ids.length !== 5 ||
      new Set(ids).size !== 5 ||
      !ids.every((id) => catalog.some((track) => track.id === id))
    )
      continue;
    // I vecchi avvii non provano un ascolto completo. I voti già espressi restano nello storico.
    const listened =
      round.completionVersion === 2 && Array.isArray(round.listened)
        ? ids.filter((id) => strings(round.listened).includes(id))
        : [];
    profile.rounds[day] = {
      ids,
      vote: typeof round.vote === "string" ? round.vote : null,
      day,
      listened,
      completionVersion: 2,
    };
  }
  profile.saved = Array.isArray(value.saved)
    ? strings(value.saved).filter((id) =>
        catalog.some((track) => track.id === id),
      )
    : [];
  profile.applications = Array.isArray(value.applications)
    ? value.applications.filter(isApplication)
    : [];
  profile.seenReveals = Array.isArray(value.seenReveals)
    ? strings(value.seenReveals)
    : [];
  return profile;
}
export function readProfile() {
  try {
    return normalizeProfile(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"),
    );
  } catch {
    return createProfile();
  }
}
export function ensureRound(profile: Profile, day: string): Profile {
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
export function writeProfile(profile: Profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
