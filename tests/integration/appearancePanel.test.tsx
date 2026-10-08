import { AppearanceProvider } from "../../src/context/appearance/AppearanceProvider.tsx";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppearancePanel } from "../../src/components/appearance/AppearancePanel.tsx";
import {
  readCustomStyle,
  readStyleLibrary,
} from "../../src/services/appearance/customStyle.ts";

describe("catalogo e raccolta stili", () => {
  it("parte da un preset, salva, ricarica la raccolta e modifica senza duplicare", () => {
    const view = render(<AppearancePanel theme="pulse" />, {
      wrapper: AppearanceProvider,
    });
    const choices = within(
      screen.getByRole("group", { name: "Scegli lo stile di NextWave" }),
    );
    expect(choices.getAllByRole("button")).toHaveLength(10);
    fireEvent.click(choices.getByRole("button", { name: "Rock: #FF5252" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Modifica il tuo stile/ }),
    );
    fireEvent.change(screen.getByLabelText("Nome dello stile"), {
      target: { value: "Rosso e nero" },
    });
    fireEvent.change(screen.getByLabelText("Logo e onda: secondo colore"), {
      target: { value: "#000000" },
    });
    fireEvent.click(screen.getByLabelText("Abbina allo sfondo"));
    fireEvent.change(screen.getByLabelText("Sidebar: primo colore"), {
      target: { value: "#220000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salva e applica" }));
    const id = readCustomStyle().savedStyleId;
    expect(readStyleLibrary()[0]).toMatchObject({
      name: "Rosso e nero",
      style: {
        brandSecondary: "#000000",
        sidebarAuto: false,
        sidebar: "#220000",
      },
    });
    fireEvent.click(choices.getByRole("button", { name: "Pop: #FF5FA2" }));
    view.unmount();
    render(<AppearancePanel theme="pulse" />, { wrapper: AppearanceProvider });
    fireEvent.click(screen.getByRole("button", { name: /I tuoi stili/ }));
    expect(screen.getByRole("dialog", { name: "I tuoi stili" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Applica" }));
    expect(readCustomStyle().savedStyleId).toBe(id);
    fireEvent.click(screen.getByRole("button", { name: /I tuoi stili/ }));
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    fireEvent.change(screen.getByLabelText("Nome dello stile"), {
      target: { value: "Rosso notte" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiorna e applica" }));
    expect(readStyleLibrary()).toHaveLength(1);
    expect(readStyleLibrary()[0].name).toBe("Rosso notte");
    fireEvent.click(
      screen.getByRole("button", { name: /Modifica il tuo stile/ }),
    );
    fireEvent.click(screen.getByLabelText("Salva come nuovo stile"));
    fireEvent.click(screen.getByRole("button", { name: "Salva e applica" }));
    expect(readStyleLibrary()).toHaveLength(2);
  });

  it("il carosello si naviga anche con la tastiera", () => {
    render(<AppearancePanel theme="pulse" />, { wrapper: AppearanceProvider });
    const rap = screen.getByRole("button", { name: "Rap: #FF8A3D" });
    rap.focus();
    fireEvent.keyDown(rap, { key: "ArrowRight" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Trap: #A56BFF" }),
    );
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(rap);
  });
});
