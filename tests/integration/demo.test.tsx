import { BrowserRouter } from "react-router-dom";
import type { Profile } from "../../src/types/models.ts";
import { getAudio } from "../helpers/dom.ts";
import { describe, test, expect, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../../src/app/DemoApp.tsx";
import {
  createProfile,
  ensureRound,
  STORAGE_KEY,
} from "../../src/services/demo/demoProfileStorage.ts";

const day = "2026-09-28";
function mount({
  onboard = true,
  hour = "18:00:00",
  profile,
}: { onboard?: boolean; hour?: string; profile?: Profile } = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${day}T${hour}Z`));
  const initial =
    profile ||
    ensureRound(
      { ...createProfile(), onboard, name: "Test", prefs: ["Trap", "Rap"] },
      day,
    );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  const view = render(<App />, { wrapper: BrowserRouter });
  const audio = getAudio();
  return { ...view, audio, initial };
}
function stored(): Profile {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
}
async function play(number = 1) {
  await act(async () =>
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: `Ascolta brano ${number}`,
      }),
    ),
  );
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

describe("ascolti giornalieri", () => {
  test("play e pausa non contano; fine completa sblocca solo il successivo", async () => {
    const { audio, initial } = mount();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(true);
    await play();
    expect(stored().rounds[day].listened).toEqual([]);
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: "Pausa brano 1" }),
    );
    expect(stored().rounds[day].listened).toEqual([]);
    await play();
    finish(audio);
    expect(stored().rounds[day].listened).toEqual([initial.rounds[day].ids[0]]);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(false);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 3" })
        .disabled,
    ).toBe(true);
    await play();
    finish(audio);
    expect(stored().rounds[day].listened).toHaveLength(1);
  });
  test("un audio fallito o raggiunto alla fine con seek non conta", async () => {
    const { audio } = mount();
    await play();
    fireEvent.error(audio);
    expect(stored().rounds[day].listened).toEqual([]);
    finish(audio, 10);
    expect(stored().rounds[day].listened).toEqual([]);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(true);
  });
  test("si vota solo dopo cinque completamenti e un solo voto viene salvato", async () => {
    const { audio, initial } = mount();
    for (let index = 1; index <= 5; index++) {
      await play(index);
      expect(
        screen.queryByRole("button", { name: "Vota questo brano" }),
      ).toBeNull();
      finish(audio);
    }
    fireEvent.click(
      screen.getAllByRole<HTMLButtonElement>("button", {
        name: "Vota questo brano",
      })[2],
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: "Conferma voto" }),
    );
    expect(stored().rounds[day].vote).toBe(initial.rounds[day].ids[2]);
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Torna a Next Wave",
      }),
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "✓ Il tuo voto" })
        .disabled,
    ).toBe(true);
  });
  test("i completamenti rimangono dopo ricaricamento", async () => {
    const first = mount();
    await play();
    finish(first.audio);
    first.unmount();
    render(<App />, { wrapper: BrowserRouter });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(false);
    expect(stored().rounds[day].listened).toHaveLength(1);
  });
  test("il cambio giorno ferma l’audio e non trasferisce completamenti", async () => {
    const { audio } = mount({ hour: "21:59:58" });
    await play();
    act(() => {
      vi.setSystemTime(new Date("2026-09-28T22:00:00Z"));
      vi.advanceTimersByTime(1000);
    });
    finish(audio);
    expect(stored().rounds["2026-09-29"].listened).toEqual([]);
    expect(stored().rounds[day].listened).toEqual([]);
    expect(audio.hasAttribute("src")).toBe(false);
  });
  test("una conferma aperta prima delle 21 non permette voti tardivi", async () => {
    const { audio } = mount();
    for (let index = 1; index <= 5; index++) {
      await play(index);
      finish(audio);
    }
    fireEvent.click(
      screen.getAllByRole<HTMLButtonElement>("button", {
        name: "Vota questo brano",
      })[0],
    );
    act(() => {
      vi.setSystemTime(new Date(`${day}T19:00:00Z`));
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: "Conferma voto" }),
    );
    expect(stored().rounds[day].vote).toBeNull();
    expect(screen.getByText(/CONTEST CONCLUSO/)).toBeTruthy();
  });
});

describe("flussi React", () => {
  test("completare l’onboarding conserva la pagina richiesta direttamente", () => {
    history.replaceState(null, "", "/profile");
    mount({ onboard: false });
    fireEvent.click(
      screen.getByRole("button", { name: "Entra in Next Wave →" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Scopri i tuoi 5 brani →" }),
    );
    expect(location.pathname).toBe("/profile");
    expect(screen.getByText("Tipo di profilo")).toBeTruthy();
  });
  test("onboarding, navigazione e palette restano disponibili", () => {
    mount({ onboard: false });
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Entra in Next Wave →",
      }),
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Scopri i tuoi 5 brani →",
      }),
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Apri il tuo profilo",
      }),
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "House: #23DDC5",
      }),
    );
    expect(
      document.documentElement.style.getPropertyValue("--custom-button"),
    ).toBe("#23ddc5");
    expect(
      JSON.parse(localStorage.getItem("nextwave-custom-style-v1") || "{}")
        .presetId,
    ).toBe("house");
    fireEvent.click(
      screen.getAllByRole<HTMLButtonElement>("button", {
        name: "Next Wave · Torna ai 5 brani",
      })[0],
    );
    expect(screen.getByText("La tua selezione")).toBeTruthy();
  });
  test("reveal mostra cinque risultati una sola volta, e si può riaprire", () => {
    mount({ hour: "19:00:00" });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Continua a esplorare →",
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Rivedi la classifica ↗",
      }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  test("il reveal di prova non sblocca audio né sopprime quello reale", () => {
    mount();
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Prova il reveal delle 21:00",
      }),
    );
    expect(stored().seenReveals).toEqual([]);
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Continua a esplorare →",
      }),
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Ascolta brano 2" })
        .disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Torna al contest",
      }),
    );
    act(() => {
      vi.setSystemTime(new Date(`${day}T19:00:00Z`));
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/CONTEST CONCLUSO/)).toBeTruthy();
    expect(stored().seenReveals).toEqual([day]);
  });
  test("i generi modificati non cambiano la selezione del giorno", () => {
    const { initial } = mount();
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Apri il tuo profilo",
      }),
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", { name: "Jazz" }),
    );
    fireEvent.click(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Salva preferenze",
      }),
    );
    expect(stored().prefs).toContain("Jazz");
    expect(stored().rounds[day].ids).toEqual(initial.rounds[day].ids);
  });
});
