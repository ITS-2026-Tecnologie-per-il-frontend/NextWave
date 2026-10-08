import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StyleStudio } from "../../src/components/appearance/StyleStudio.tsx";
import { useCustomStyle } from "../../src/hooks/useCustomStyle.ts";
import {
  originalStyle,
  readCustomStyle,
  saveCustomStyle,
} from "../../src/services/appearance/customStyle.ts";
function AppliedStyle() {
  useCustomStyle(true);
  return null;
}
describe("editor di personalizzazione", () => {
  it("mostra controlli concreti, aggiorna solo anteprima e annulla senza salvare", () => {
    const onClose = vi.fn();
    const { container } = render(<StyleStudio onClose={onClose} />);
    expect(screen.queryByLabelText("Accento")).toBeNull();
    expect(screen.queryByLabelText("Secondario")).toBeNull();
    fireEvent.change(screen.getByLabelText("Sfondo: primo colore"), {
      target: { value: "#ffff00" },
    });
    fireEvent.change(screen.getByLabelText("Sfondo: secondo colore"), {
      target: { value: "#88cc44" },
    });
    const preview = container.querySelector(".custom-preview") as HTMLElement;
    expect(preview.style.getPropertyValue("--custom-page-bg")).toBe(
      "linear-gradient(135deg, #ffff00, #88cc44)",
    );
    fireEvent.change(screen.getByLabelText("Il tuo nome"), {
      target: { value: "Alessio" },
    });
    expect(readCustomStyle().active).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(readCustomStyle().style).toEqual(originalStyle);
  });
  it("confronta, ripristina l’anteprima quando si modifica e salva solo su Applica", () => {
    const { container } = render(<StyleStudio onClose={vi.fn()} />);
    const preview = container.querySelector(".custom-preview") as HTMLElement;
    fireEvent.change(screen.getByLabelText("Pulsanti e selezioni"), {
      target: { value: "#ff0000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confronta con originale" }),
    );
    expect(preview.style.getPropertyValue("--custom-button")).toBe(
      originalStyle.buttons,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sfumatura Aurora" }));
    expect(preview.style.getPropertyValue("--custom-button")).toBe("#ff0000");
    fireEvent.click(screen.getByRole("button", { name: "Salva e applica" }));
    expect(readCustomStyle()).toMatchObject({
      active: true,
      style: { buttons: "#ff0000", cardStart: "#322345", cardEnd: "#173d42" },
    });
  });
  it("applica e rimuove i soli token custom senza toccare i colori base", () => {
    const { unmount } = render(<AppliedStyle />);
    act(() =>
      saveCustomStyle(
        { ...originalStyle, background: "#ffff00", backgroundEnd: "#88cc44" },
        true,
      ),
    );
    expect(document.documentElement.dataset.custom).toBe("true");
    expect(
      document.documentElement.style.getPropertyValue("--custom-page-bg"),
    ).toBe("linear-gradient(135deg, #ffff00, #88cc44)");
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--purple")).toBe(
      "",
    );
    act(() => saveCustomStyle(originalStyle, false));
    expect(document.documentElement.dataset.custom).toBe("true");
    expect(
      document.documentElement.style.getPropertyValue("--custom-page-bg"),
    ).toBe(
      `linear-gradient(135deg, ${originalStyle.background}, ${originalStyle.backgroundEnd})`,
    );
    unmount();
    expect(document.documentElement.dataset.custom).toBeUndefined();
  });

  it("mostra i controlli delle classifiche e del volume con pulsanti bianchi e neri", () => {
    const { container } = render(<StyleStudio onClose={vi.fn()} />);
    const preview = container.querySelector(".custom-preview") as HTMLElement;
    for (const color of ["#ffffff", "#000000"]) {
      fireEvent.change(screen.getByLabelText("Pulsanti e selezioni"), {
        target: { value: color },
      });
      expect(preview.style.getPropertyValue("--custom-button")).toBe(color);
      expect(preview.style.getPropertyValue("--custom-player-color")).not.toBe(
        "#000000",
      );
    }
    const weekly = screen.getByRole("button", { name: "Settimanale" });
    fireEvent.click(weekly);
    expect(weekly.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Giornaliera" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    const volume = screen.getByLabelText("Volume") as HTMLInputElement;
    fireEvent.change(volume, { target: { value: "0.35" } });
    expect(volume.style.getPropertyValue("--volume")).toBe("35%");
    expect(readCustomStyle().active).toBe(false);
  });
});
