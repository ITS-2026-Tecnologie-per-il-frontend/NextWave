import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloudRepository } from "../../src/services/cloudRepository.ts";
import type {
  Dashboard,
  Profile,
  AdminDashboard,
} from "../../src/types/models.ts";
import { getAudio } from "../helpers/dom.ts";
import { describe, expect, test, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Account } from "../../src/app/CloudAccount.tsx";
import Auth from "../../src/pages/Auth.tsx";
import { getDataConfig } from "../../src/config/environment.ts";
import { createCloudRepository } from "../../src/services/cloudRepository.ts";
import { STORAGE_KEY } from "../../src/services/demoProfileStorage.ts";

const day = "2026-09-28";
function fixture(): Dashboard {
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
    progress: vi.fn(
      async (_session: string, _position: number, finish = false) => {
        if (finish) state.profile.rounds[day].listened.push("slot1");
        return { completed: finish };
      },
    ),
    saveProfile: vi.fn(async (profile: Profile) => {
      state.profile = { ...state.profile, ...profile };
    }),
    vote: vi.fn(async (id: string) => {
      state.profile.rounds[day].vote = id;
    }),
    favorite: vi.fn(async () => {}),
    rankings: vi.fn(async () => ({ reference: day, rows: [] })),
    reveal: vi.fn(async () => []),
    seenReveal: vi.fn(async () => {}),
    submitApplication: vi.fn(async () => {}),
    setAccountType: vi.fn(async (accountType: "listener" | "artist") => {
      state.profile.accountType = accountType;
    }),
    adminDashboard: vi.fn(async (): Promise<AdminDashboard> => ({
      access: { allowed: true, owner: true },
      applications: [],
      accounts: [
        {
          id: "account-1",
          email: "santonithomas9@gmail.com",
          owner: true,
          created: null,
        },
      ],
    })),
    adminAction: vi.fn(async () => {}),
    adminPreview: vi.fn(async () => ({ audioUrl: "/audio/0.wav" })),
    uploadAvatar: vi.fn(async () => {}),
    removeAvatar: vi.fn(async () => {}),
  };
  const client = { auth: { signOut: vi.fn(async () => ({ error: null })) } };
  render(
    <Account
      client={client as unknown as SupabaseClient}
      repository={repository}
    />,
  );
  await screen.findByText("La tua selezione");
  return { repository, state, client, audio: getAudio() };
}
function finish(audio: HTMLAudioElement, start = 0) {
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
  test("due brani reali sono visibili e il voto si sblocca dopo entrambi", async () => {
    const state = fixture();
    state.profile.rounds[day].ids = ["slot1", "slot2"];
    state.profile.rounds[day].listened = ["slot1", "slot2"];
    state.tracks = state.tracks.slice(0, 2).map((track, index) => ({
      ...track,
      isDemo: false,
      genre: index === 0 ? "Hip hop" : "Reggaeton",
    }));
    const { repository } = await mountCloud(state);
    expect(
      screen.getByRole("button", { name: "Ascolta brano 1" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ascolta brano 2" }),
    ).toBeTruthy();
    expect(screen.getByText("2/2 completati")).toBeTruthy();
    expect(
      screen.getAllByRole("article", {
        name: /Spazio .*in attesa di un brano/,
      }),
    ).toHaveLength(3);
    const votes = screen.getAllByRole<HTMLButtonElement>("button", {
      name: "Vota questo brano",
    });
    expect(votes[0].disabled).toBe(false);
    fireEvent.click(votes[0]);
    fireEvent.click(screen.getByRole("button", { name: "Conferma voto" }));
    await waitFor(() => expect(repository.vote).toHaveBeenCalledWith("slot1"));
  });
  test("un admin artista può caricare ancora dopo la traccia mensile", async () => {
    const state = fixture();
    state.adminAccess = { allowed: true, owner: false };
    state.profile.accountType = "artist";
    state.profile.applications = [
      {
        id: "already-sent",
        title: "Track",
        artist: "Artist",
        listeners: 10,
        subgenre: "Pop",
        spotify: "https://open.spotify.com/track/1234567890123456789012",
        submittedAt: state.serverTime,
      },
    ];
    await mountCloud(state);
    fireEvent.click(screen.getByRole("button", { name: "Per gli artisti" }));
    await screen.findByRole("button", { name: "Candida un brano" });
    expect(
      screen.queryByText("La tua traccia del mese è stata inviata."),
    ).toBeNull();
  });
  test("la sezione artisti si attiva dal profilo e sparisce tornando ascoltatore", async () => {
    const { repository } = await mountCloud();
    expect(
      screen.queryByRole("button", { name: "Per gli artisti" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Il tuo profilo" }));
    fireEvent.click(screen.getByRole("button", { name: "Artista" }));
    await screen.findByRole("button", { name: "Per gli artisti" });
    expect(repository.setAccountType).toHaveBeenCalledWith("artist");
    fireEvent.click(screen.getByRole("button", { name: "Per gli artisti" }));
    await screen.findByText("Non hai ancora inviato candidature.");
    expect(screen.queryByLabelText("Nome artista")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Candida la traccia del mese" }),
    );
    expect(screen.getByLabelText("Nome artista")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Il tuo profilo" }));
    fireEvent.click(screen.getByRole("button", { name: "Ascoltatore" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Per gli artisti" }),
      ).toBeNull(),
    );
  });
  test("un ascoltatore che apre artist direttamente viene riportato al profilo", async () => {
    await mountCloud();
    await act(async () => {
      location.hash = "artist";
      window.dispatchEvent(new Event("hashchange"));
    });
    await screen.findByText("Tipo di profilo");
    expect(screen.queryByLabelText("Nome artista")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Per gli artisti" }),
    ).toBeNull();
  });
  test("la candidatura del mese resta in primo piano e blocca un nuovo caricamento", async () => {
    const state = fixture();
    state.profile.accountType = "artist";
    state.profile.applications = [
      {
        id: "month-song",
        title: "La mia traccia",
        artist: "Artist",
        listeners: 30,
        subgenre: "Pop",
        spotify: "https://open.spotify.com/track/1234567890123456789012",
        created: state.serverTime,
        submittedAt: state.serverTime,
        status: "rejected",
      },
    ];
    await mountCloud(state);
    fireEvent.click(screen.getByRole("button", { name: "Per gli artisti" }));
    await screen.findByText("La mia traccia");
    expect(
      screen.getByText("La tua traccia del mese è stata inviata."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Candida la traccia del mese" }),
    ).toBeNull();
    expect(screen.queryByLabelText("Nome artista")).toBeNull();
  });
  test("nasconde il pannello agli utenti ordinari anche con URL admin", async () => {
    location.hash = "admin";
    const { repository } = await mountCloud();
    expect(screen.queryByRole("button", { name: "Pannello admin" })).toBeNull();
    expect(repository.adminDashboard).not.toHaveBeenCalled();
    await waitFor(() => expect(location.hash).toBe("#daily"));
  });
  test("mostra il pannello e protegge il superadmin dalla revoca", async () => {
    const state = fixture();
    state.adminAccess = { allowed: true, owner: true };
    await mountCloud(state);
    fireEvent.click(screen.getByRole("button", { name: "Pannello admin" }));
    await screen.findByText("santonithomas9@gmail.com");
    expect(screen.getByText("Superadmin · protetto")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Revoca accesso" })).toBeNull();
  });
  test("approva solo dopo checklist e conferma e autorizza un altro admin", async () => {
    const state = fixture();
    state.adminAccess = { allowed: true, owner: true };
    const { repository } = await mountCloud(state);
    repository.adminDashboard.mockResolvedValue({
      access: { allowed: true, owner: true },
      accounts: [],
      applications: [
        {
          id: "application-1",
          artist: "Artist",
          title: "Song",
          listeners: 50,
          subgenre: "Pop",
          spotify: "https://open.spotify.com/track/1234567890123456789012",
          genre: "Pop",
          language: "Italiano",
          status: "pending",
          audioState: "ready",
          duration: 12,
          expires: null,
          reviewable: true,
          reviewNote: null,
          reviewedAt: null,
        },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Pannello admin" }));
    await screen.findByText("Song");
    const approve = screen.getByRole<HTMLButtonElement>("button", {
      name: "Approva e programma",
    });
    expect(approve.disabled).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Carica ascolto privato" }),
    );
    await waitFor(() =>
      expect(repository.adminPreview).toHaveBeenCalledWith("application-1"),
    );
    for (const checkbox of screen.getAllByRole("checkbox"))
      fireEvent.click(checkbox);
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);
    expect(repository.adminAction).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Conferma approvazione" }),
    );
    await waitFor(() =>
      expect(repository.adminAction).toHaveBeenCalledWith(
        "approve",
        expect.objectContaining({
          applicationId: "application-1",
          checks: [true, true, true],
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Autorizza admin",
        }).disabled,
      ).toBe(false),
    );
    fireEvent.change(
      screen.getByLabelText("Email dell’account da autorizzare"),
      { target: { value: "moderator@example.com" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Autorizza admin" }));
    await waitFor(() =>
      expect(repository.adminAction).toHaveBeenCalledWith("grant", {
        email: "moderator@example.com",
      }),
    );
  });
  test("un admin aggiuntivo non vede la gestione degli account", async () => {
    const state = fixture();
    state.adminAccess = { allowed: true, owner: false };
    const { repository } = await mountCloud(state);
    repository.adminDashboard.mockResolvedValue({
      access: { allowed: true, owner: false },
      applications: [],
      accounts: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Pannello admin" }));
    await screen.findByText("Nessuna candidatura in questa sezione.");
    expect(
      screen.queryByRole("button", { name: "Autorizza admin" }),
    ).toBeNull();
    expect(screen.queryByText("Account autorizzati")).toBeNull();
  });
  test("usa l’audio autorizzato dal server e sblocca il successivo dopo conferma DB", async () => {
    const { audio, repository } = await mountCloud();
    await act(async () =>
      fireEvent.click(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Ascolta brano 1",
        }),
      ),
    );
    expect(repository.beginListening).toHaveBeenCalledWith("slot1");
    await waitFor(() => expect(audio.getAttribute("src")).toBe("/audio/0.wav"));
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(true);
    await act(async () => finish(audio));
    expect(repository.progress).toHaveBeenCalledWith("session-1", 12, true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  test("il rifiuto del completamento non salva né sblocca i brani", async () => {
    const { audio, repository } = await mountCloud();
    repository.progress.mockRejectedValue(
      new Error("Ascolta il brano fino alla fine."),
    );
    await act(async () =>
      fireEvent.click(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Ascolta brano 1",
        }),
      ),
    );
    await act(async () => finish(audio));
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toContain(
      "Ascolta il brano fino alla fine.",
    );
  });
  test("un seek alla fine non invia una conferma al database", async () => {
    const { audio, repository } = await mountCloud();
    await act(async () =>
      fireEvent.click(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Ascolta brano 1",
        }),
      ),
    );
    await act(async () => finish(audio, 10));
    expect(
      repository.progress.mock.calls.some((call) => call[2] === true),
    ).toBe(false);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(true);
  });
  test("una scrittura fallita non modifica il profilo locale", async () => {
    const { repository } = await mountCloud();
    repository.saveProfile.mockRejectedValue(
      new Error("Salvataggio non disponibile."),
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Apri il tuo profilo",
      }),
    );
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Nuovo Nome" },
    });
    await act(async () =>
      fireEvent.click(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Salva preferenze",
        }),
      ),
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
      screen.getAllByRole<HTMLButtonElement>("button", {
        name: "Vota questo brano",
      })[0],
    );
    await act(async () =>
      fireEvent.click(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Conferma voto",
        }),
      ),
    );
    expect(state.profile.rounds[day].vote).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(
      "Hai già votato oggi.",
    );
    expect(screen.queryByText("✓ Il tuo voto è su Next Wave.")).toBeNull();
  });
  test("catalogo vuoto viene segnalato senza creare cinque brani locali", async () => {
    const state = fixture();
    state.profile.rounds = {};
    state.tracks = [];
    render(
      <Account
        client={{ auth: {} } as unknown as SupabaseClient}
        repository={{ dashboard: async () => state } as CloudRepository}
      />,
    );
    await screen.findByText("Stiamo preparando la tua selezione.");
    expect(
      screen.getByAltText("Onda sonora cromata viola e lime"),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("article", {
        name: /Spazio .*in attesa di un brano/,
      }),
    ).toHaveLength(5);
    expect(
      screen.queryByRole("button", { name: "Rivedi la classifica ↗" }),
    ).toBeNull();
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
    render(<Auth client={client as unknown as SupabaseClient} />);
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Non hai un account? Registrati",
      }),
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-only-password" },
    });
    await act(async () =>
      fireEvent.click(
        screen.getByRole<HTMLButtonElement>("button", { name: "Crea account" }),
      ),
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
    } as unknown as SupabaseClient);
    await expect(repository.dashboard()).rejects.toThrow("SQL Editor");
  });
});
