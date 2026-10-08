import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ProfileActivity } from "../../src/components/ProfileActivity.tsx";
import {
  emptyApplicationFilters,
  matchesApplication,
} from "../../src/components/ApplicationFilters.tsx";
import { createProfile } from "../../src/services/demoProfileStorage.ts";
import Artist from "../../src/pages/Artist.tsx";
import type { Application } from "../../src/types/models.ts";

const day = "2026-10-08";
describe("attività e candidature", () => {
  test("voti e preferiti restano anonimi fino al reveal anche con metadati nel client", () => {
    const profile = createProfile();
    profile.saved = ["track"];
    profile.rounds[day] = {
      day,
      ids: ["slot"],
      listened: ["slot"],
      vote: "slot",
    };
    const track = {
      id: "track",
      genre: "Rap",
      title: "Titolo segreto",
      artist: "Artista segreto",
      spotifyUrl: "https://example.com/song",
      day,
      slot: 1,
      revealed: false,
    };
    const onSave = vi.fn();
    const props = {
      profile,
      tracks: [{ ...track, id: "slot" }],
      favorites: [track],
      clock: { day, seconds: 40000, revealed: false },
      cloud: true,
      onSave,
    };
    const view = render(<ProfileActivity {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Esplora voti espressi: 1" }),
    );
    expect(screen.getByText("Brano 01")).toBeTruthy();
    expect(screen.queryByText("Titolo segreto")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chiudi attività" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Esplora scoperte salvate: 1" }),
    );
    expect(screen.queryByText("Artista segreto")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Rimuovi dai preferiti: brano anonimo",
      }),
    );
    expect(onSave).toHaveBeenCalledWith("track");
    view.rerender(
      <ProfileActivity {...props} favorites={[{ ...track, revealed: true }]} />,
    );
    expect(screen.getByText("Titolo segreto")).toBeTruthy();
    expect(screen.getByText("Artista segreto")).toBeTruthy();
    expect(screen.getByRole("link")).toBeTruthy();
  });
  test("filtri combinati, data italiana e data del contest", () => {
    const app: Application = {
      artist: "Luna",
      title: "Notte",
      listeners: 50,
      subgenre: "Rap",
      spotify: "url",
      submittedAt: "2026-10-07T23:30:00Z",
      contestDay: day,
    };
    expect(
      matchesApplication(app, {
        ...emptyApplicationFilters,
        artist: " LUN ",
        title: "ott",
        date: day,
      }),
    ).toBe(true);
    expect(
      matchesApplication(app, {
        ...emptyApplicationFilters,
        date: "2026-10-07",
      }),
    ).toBe(false);
    expect(
      matchesApplication(app, {
        ...emptyApplicationFilters,
        dateType: "contest",
        date: day,
      }),
    ).toBe(true);
  });
  test("ritiro confermato solo per candidature non approvate", async () => {
    const base: Application = {
      artist: "Luna",
      title: "Notte",
      listeners: 50,
      subgenre: "Rap",
      spotify: "url",
      created: "2026-09-01T12:00:00Z",
    };
    const onRemove = vi.fn(async () => {});
    render(
      <Artist
        applications={[
          { ...base, id: "pending", status: "pending" },
          { ...base, id: "approved", status: "approved", title: "Accettata" },
          { ...base, id: "removed", removedAt: day, title: "Ritirata" },
        ]}
        onSubmit={() => {}}
        onRemove={onRemove}
      />,
    );
    expect(screen.queryByText("Ritirata")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Elimina candidatura" }),
    ).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Elimina candidatura" }),
    );
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Conferma eliminazione" }),
    );
    expect(onRemove).toHaveBeenCalledWith("pending");
    fireEvent.change(screen.getByLabelText("Filtra per brano"), {
      target: { value: "Accettata" },
    });
    expect(screen.queryByText("Notte")).toBeNull();
  });
});
