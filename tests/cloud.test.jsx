import { describe, expect, test, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Account } from "../src/features/cloud/CloudApp.jsx";
import Auth from "../src/features/cloud/Auth.jsx";
import { getDataConfig } from "../src/services/supabase.js";
import { createCloudRepository } from "../src/services/cloudRepository.js";
import { STORAGE_KEY } from "../src/services/storage.js";

const day = "2026-09-28";
function fixture() {
  const ids = ["slot1", "slot2", "slot3", "slot4", "slot5"];
  return {
    serverTime: "2026-09-28T18:00:00Z",
    clock: { day, seconds: 20 * 3600, revealed: false },
    profile: {
      uid: "account-1",
      name: "Account Test",
      theme: "pulse",
      prefs: ["Indie"],
      onboard: true,
      connected: false,
      rounds: { [day]: { day, ids, listened: [], vote: null } },
      saved: [],
      applications: [],
      seenReveals: [],
    },
    tracks: ids.map((id) => ({
      id,
      genre: "Indie",
      mood: "Sognante",
      lang: "Italiano",
      title: null,
      artist: null,
      isDemo: true,
    })),
    favorites: [],
  };
}
async function mountCloud(state = fixture()) {
  const repository = {
    dashboard: vi.fn(async () => structuredClone(state)),
    beginListening: vi.fn(async () => ({
      sessionId: "session-1",
      audioUrl: "/audio/0.wav",
      duration: 12,
    })),
    progress: vi.fn(async (_session, _position, finish) => {
      if (finish) state.profile.rounds[day].listened.push("slot1");
      return { completed: finish };
    }),
    saveProfile: vi.fn(async (profile) => {
      state.profile = { ...state.profile, ...profile };
    }),
    vote: vi.fn(async (id) => {
      state.profile.rounds[day].vote = id;
    }),
    favorite: vi.fn(),
    rankings: vi.fn(async () => ({ reference: day, rows: [] })),
    reveal: vi.fn(),
    seenReveal: vi.fn(),
    submitApplication: vi.fn(),
  };
  const client = { auth: { signOut: vi.fn(async () => ({ error: null })) } };
  render(<Account client={client} repository={repository} />);
  await screen.findByText("La tua selezione");
  return { repository, state, client, audio: document.querySelector("audio") };
}
function finish(audio, start = 0) {
  Object.defineProperty(audio, "ended", { configurable: true, value: true });
  Object.defineProperty(audio, "duration", { configurable: true, value: 12 });
  Object.defineProperty(audio, "played", {
    configurable: true,
    value: { length: 1, start: () => start, end: () => 12 },
  });
  audio.currentTime = 12;
  fireEvent.ended(audio);
}

describe("account cloud", () => {
  test("usa l’audio autorizzato dal server e sblocca il successivo dopo conferma DB", async () => {
    const { audio, repository } = await mountCloud();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Ascolta brano 1" })),
    );
    expect(repository.beginListening).toHaveBeenCalledWith("slot1");
    await waitFor(() => expect(audio.getAttribute("src")).toBe("/audio/0.wav"));
    expect(
      screen.getByRole("button", { name: "Ascolta brano 2" }).disabled,
    ).toBe(true);
    await act(async () => finish(audio));
    expect(repository.progress).toHaveBeenCalledWith("session-1", 12, true);
    expect(
      screen.getByRole("button", { name: "Ascolta brano 2" }).disabled,
    ).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  test("il rifiuto del completamento non salva né sblocca i brani", async () => {
    const { audio, repository } = await mountCloud();
    repository.progress.mockRejectedValue(
      new Error("Ascolta il brano fino alla fine."),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Ascolta brano 1" })),
    );
    await act(async () => finish(audio));
    expect(
      screen.getByRole("button", { name: "Ascolta brano 2" }).disabled,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toContain(
      "Ascolta il brano fino alla fine.",
    );
  });
  test("un seek alla fine non invia una conferma al database", async () => {
    const { audio, repository } = await mountCloud();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Ascolta brano 1" })),
    );
    await act(async () => finish(audio, 10));
    expect(
      repository.progress.mock.calls.some((call) => call[2] === true),
    ).toBe(false);
    expect(
      screen.getByRole("button", { name: "Ascolta brano 2" }).disabled,
    ).toBe(true);
  });
  test("una scrittura fallita non modifica il profilo locale", async () => {
    const { repository } = await mountCloud();
    repository.saveProfile.mockRejectedValue(
      new Error("Salvataggio non disponibile."),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Apri il tuo profilo" }),
    );
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Nuovo Nome" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Salva preferenze" })),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Salvataggio non disponibile.",
    );
    expect(screen.getByRole("heading", { name: "Account Test" })).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  test("un voto rifiutato dal database resta disponibile senza falsa conferma", async () => {
    const state = fixture();
    state.profile.rounds[day].listened = [...state.profile.rounds[day].ids];
    const { repository } = await mountCloud(state);
    repository.vote.mockRejectedValue(new Error("Hai già votato oggi."));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Vota questo brano" })[0],
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Conferma voto" })),
    );
    expect(state.profile.rounds[day].vote).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(
      "Hai già votato oggi.",
    );
    expect(screen.queryByText("✓ Il tuo voto è nel pulse.")).toBeNull();
  });
  test("catalogo vuoto viene segnalato senza creare cinque brani locali", async () => {
    const state = fixture();
    state.profile.rounds = {};
    state.tracks = [];
    render(
      <Account
        client={{ auth: {} }}
        repository={{ dashboard: async () => state }}
      />,
    );
    await screen.findByText("Stiamo preparando il tuo pulse.");
    expect(
      screen.queryByRole("button", { name: "Ascolta brano 1" }),
    ).toBeNull();
  });
});

describe("autenticazione e configurazione", () => {
  test("la registrazione gestisce la conferma email e gli errori", async () => {
    const client = {
      auth: {
        signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
      },
    };
    render(<Auth client={client} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Non hai un account? Registrati" }),
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-only-password" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Crea account" })),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Controlla la tua email",
    );
  });
  test("chiavi segrete o service_role sono rifiutate prima di creare il client", () => {
    const env = {
      VITE_DATA_MODE: "supabase",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test",
    };
    expect(() => getDataConfig(env)).toThrow("chiave segreta");
    const payload = btoa(JSON.stringify({ role: "service_role" }));
    expect(() =>
      getDataConfig({
        ...env,
        VITE_SUPABASE_PUBLISHABLE_KEY: `header.${payload}.signature`,
      }),
    ).toThrow("mai service_role");
    expect(
      getDataConfig({
        ...env,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }).mode,
    ).toBe("supabase");
    expect(() => getDataConfig({ VITE_DATA_MODE: "supabase" })).toThrow(
      "Configura URL",
    );
  });
  test("gli errori di migrazioni mancanti hanno un messaggio utilizzabile", async () => {
    const repository = createCloudRepository({
      rpc: async () => ({ error: { code: "PGRST202", message: "missing" } }),
    });
    await expect(repository.dashboard()).rejects.toThrow("SQL Editor");
  });
});
vi.mock("../src/features/cloud/SpotifyConnection.jsx", () => ({
  default: () => null,
}));
