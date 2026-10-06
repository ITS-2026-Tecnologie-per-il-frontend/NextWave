import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import CloudRankings from "../../src/pages/CloudRankings.tsx";
import type { CloudRepository } from "../../src/services/cloudRepository.ts";
import { getDataConfig } from "../../src/config/environment.ts";

test("il calendario richiede la classifica scelta e torna all’ultima disponibile", async () => {
  const rankings = vi.fn(async (_period: string, day?: string) => ({
    reference: day || "2026-10-05",
    latestDay: "2026-10-05",
    rows: [],
  }));
  render(
    <CloudRankings repository={{ rankings } as unknown as CloudRepository} />,
  );
  await screen.findByText(
    "Nessun risultato disponibile per il periodo scelto.",
  );
  fireEvent.change(screen.getByLabelText("Giorno della classifica"), {
    target: { value: "2026-10-03" },
  });
  await waitFor(() =>
    expect(rankings).toHaveBeenLastCalledWith("day", "2026-10-03"),
  );
  await screen.findByText(/03\/10\/2026/);
  fireEvent.click(
    screen.getByRole("button", { name: "Torna all’ultimo contest concluso" }),
  );
  await waitFor(() =>
    expect(rankings).toHaveBeenLastCalledWith("day", undefined),
  );
});

test("la modalità demo non è più accessibile dal sito", () => {
  expect(() => getDataConfig({ VITE_DATA_MODE: "demo" })).toThrow(
    "demo è disattivata",
  );
  expect(() => getDataConfig({})).toThrow("Configura URL");
});
