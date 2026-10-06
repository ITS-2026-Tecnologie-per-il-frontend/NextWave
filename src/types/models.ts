import type { RefObject } from "react";

export type Route = "daily" | "ranks" | "artist" | "profile" | "admin";
export type RankingPeriod = "day" | "week";
export type Notify = (message: string) => void;

export interface Clock {
  day: string;
  seconds: number;
  revealed: boolean;
}

export interface Round {
  day: string;
  ids: string[];
  listened: string[];
  vote: string | null;
  completionVersion?: number;
}

// Le identità dei brani cloud sono nascoste fino alla rivelazione.
export interface Track {
  id: string;
  genre: string;
  title: string | null;
  artist: string | null;
  mood?: string;
  lang?: string;
  isDemo?: boolean;
  saved?: boolean;
  spotifyUrl?: string | null;
}

export interface DemoTrack extends Track {
  title: string;
  artist: string;
  mood: string;
  lang: string;
  audio: string;
  listeners: number;
  exposures: number;
  votes: number;
}

export interface RankingRow extends Track {
  votes: number;
  exposures: number;
  score: number;
}

export interface RankingsResult {
  reference: string;
  rows: RankingRow[];
}

export interface Application {
  artist: string;
  title: string;
  listeners: string | number;
  subgenre: string;
  spotify: string;
  rights?: string | boolean;
  genre?: string;
  language?: string;
  mood?: string;
  id?: string;
  created?: string;
  status?: string;
  audioState?: string | null;
  audioDeletedAt?: string | null;
  contestDay?: string | null;
}

export interface Profile {
  uid: string;
  name: string;
  prefs: string[];
  onboard: boolean;
  rounds: Record<string, Round>;
  saved: string[];
  applications: Application[];
  seenReveals: string[];
  theme: string;
}

export type ProfileChanges = Partial<
  Pick<Profile, "name" | "prefs" | "onboard" | "theme">
>;
export type ProfileUpdate = (
  changes: ProfileChanges,
) => void | Promise<unknown>;

export interface Dashboard {
  adminAccess?: AdminAccess;
  profile: Profile;
  tracks: Track[];
  favorites: Track[];
  clock: Clock;
  serverTime: string;
}

export interface AdminAccess {
  allowed: boolean;
  owner: boolean;
}

export interface AdminApplication extends Application {
  id: string;
  duration: number | null;
  expires: string | null;
  reviewable: boolean;
  reviewNote: string | null;
  reviewedAt: string | null;
}

export interface AdminDashboard {
  access: AdminAccess;
  applications: AdminApplication[];
  accounts: {
    id: string;
    email: string;
    owner: boolean;
    created: string | null;
  }[];
}

export interface ListeningSession {
  sessionId: string;
  audioUrl: string;
  duration: number;
}

export interface PlayerStatus {
  active: string | null;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  loading?: boolean;
}

export interface Player extends PlayerStatus {
  audioRef: RefObject<HTMLAudioElement | null>;
  play: (id: string) => Promise<void>;
  setVolume: (volume: number) => void;
  track?: Track;
}

export type DemoDialog =
  | { type: "vote"; id: string }
  | { type: "reveal"; day: string; preview: boolean }
  | { type: "success" };

export type CloudDialog =
  | { type: "vote"; id: string }
  | { type: "reveal"; day: string; rows: RankingRow[] };
