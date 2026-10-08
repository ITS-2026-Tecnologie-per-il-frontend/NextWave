import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  contrastText,
  originalStyle,
  readCustomStyle,
  saveCustomStyle,
  styleVariables,
  readStyleLibrary,
  saveNamedStyle,
} from "../../src/services/customStyle.ts";
import { themes } from "../../src/data/themes.ts";

const storageKey = "nextwave-custom-style-v1";

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(text: string, background: string) {
  const a = luminance(text);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function interpolateHex(start: string, end: string, amount: number) {
  return `#${[1, 3, 5]
    .map((index) => {
      const a = parseInt(start.slice(index, index + 2), 16);
      const b = parseInt(end.slice(index, index + 2), 16);
      return Math.round(a + (b - a) * amount)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

describe("personalizzazione locale", () => {
  beforeEach(() => localStorage.clear());

  it("parte dall’originale senza attivarlo", () => {
    expect(readCustomStyle()).toEqual({ active: false, style: originalStyle });
  });

  it("salva, notifica e disattiva senza perdere il progetto", () => {
    const listener = vi.fn();
    window.addEventListener("nextwave-style", listener);
    const style = { ...originalStyle, radius: 27, font: "Georgia" };
    saveCustomStyle(style, true);
    expect(readCustomStyle()).toEqual({ active: true, style });
    saveCustomStyle(style, false);
    expect(readCustomStyle()).toEqual({ active: false, style });
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener("nextwave-style", listener);
  });

  it("migra le personalizzazioni precedenti conservando l’attivazione", () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        active: true,
        style: {
          background: "#FFFF00",
          panel: "#123456",
          secondary: "#FEDCBA",
          accent: "#FFAACC",
          radius: 20,
          font: "Arial",
          shadow: 18,
          "--bg": "url(https://example.com)",
        },
      }),
    );
    expect(readCustomStyle()).toEqual({
      active: true,
      style: {
        ...originalStyle,
        background: "#ffff00",
        backgroundEnd: "#ffff00",
        cardStart: "#123456",
        cardEnd: "#fedcba",
        buttons: "#ffaacc",
        radius: 20,
        font: "Arial",
        shadow: 18,
      },
    });
  });

  it.each([
    { background: "url(https://example.com)" },
    { backgroundEnd: null },
    { brandPrimary: "#fff" },
    { brandSecondary: "url(x)" },
    { sidebarAuto: "true" },
    { sidebar: null },
    { cardStart: "#fff" },
    { cardEnd: null },
    { buttons: "red" },
    { radius: "12" },
    { radius: -1 },
    { radius: 33 },
    { shadow: 31 },
    { shadow: null },
    { font: "Arial; color: red" },
  ])("rifiuta valori corrotti o CSS arbitrario: %j", (invalid) => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ active: true, style: { ...originalStyle, ...invalid } }),
    );
    expect(readCustomStyle()).toEqual({ active: false, style: originalStyle });
  });

  it("ignora JSON corrotto e attivazioni non booleane", () => {
    localStorage.setItem(storageKey, "{");
    expect(readCustomStyle().active).toBe(false);
    localStorage.setItem(
      storageKey,
      JSON.stringify({ active: "true", style: originalStyle }),
    );
    expect(readCustomStyle().active).toBe(false);
  });

  it("non salva dati non validi e non sovrascrive il progetto esistente", () => {
    saveCustomStyle(originalStyle, true);
    expect(() =>
      saveCustomStyle({ ...originalStyle, shadow: Infinity }, true),
    ).toThrow(TypeError);
    expect(readCustomStyle()).toEqual({ active: true, style: originalStyle });
  });

  it("espone solo token isolati da logo, campi di testo e avatar", () => {
    const variables = styleVariables(originalStyle);
    expect(
      Object.keys(variables).every((name) => name.startsWith("--custom-")),
    ).toBe(true);
    expect(variables).not.toHaveProperty("--bg");
    expect(variables).not.toHaveProperty("--text");
    expect(variables).not.toHaveProperty("--lime");
    expect(variables).not.toHaveProperty("--purple");
  });

  it.each(["#ffffff", "#000000", "#ffff00", "#777777", "#ff00ff", "#00ffff"])(
    "mantiene contrasto leggibile su sfondo e pulsanti %s",
    (color) => {
      const variables = styleVariables({
        ...originalStyle,
        background: color,
        backgroundEnd: color,
        buttons: color,
      });
      expect(
        contrast(variables["--custom-page-text"], color),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(variables["--custom-page-muted"], color),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(variables["--custom-button-text"], color),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("conserva lo sfondo precedente a tinta unita e salva la nuova sfumatura", () => {
    const { backgroundEnd, ...legacy } = originalStyle;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ active: true, style: legacy }),
    );
    expect(readCustomStyle().style.backgroundEnd).toBe(legacy.background);
    saveCustomStyle({ ...legacy, backgroundEnd }, true);
    expect(readCustomStyle().style.backgroundEnd).toBe(backgroundEnd);
  });

  it.each(["#ffffff", "#000000", "#111111", "#ff0000", "#0000ff", "#ffff00"])(
    "conserva i pulsanti %s e rende visibile il player sul fondo e sulla barra vuota",
    (buttons) => {
      const variables = styleVariables({ ...originalStyle, buttons });
      expect(variables["--custom-button"]).toBe(buttons);
      expect(
        contrast(variables["--custom-button-text"], buttons),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          variables["--custom-control-text"],
          variables["--custom-control-bg"],
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(variables["--custom-player-color"], "#121314"),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(variables["--custom-player-color"], "#49484e"),
      ).toBeGreaterThanOrEqual(3);
      if (buttons === "#ffffff")
        expect(variables["--custom-player-color"]).toBe(buttons);
    },
  );

  it.each([
    ["#ffffff", "#000000"],
    ["#ffff00", "#7fc044"],
    ["#111122", "#173d42"],
  ])(
    "mantiene testo leggibile sullo sfondo sfumato %s → %s",
    (background, backgroundEnd) => {
      const variables = styleVariables({
        ...originalStyle,
        background,
        backgroundEnd,
      });
      for (let sample = 0; sample <= 100; sample++) {
        const rendered = interpolateHex(
          variables["--custom-page-start"],
          variables["--custom-page-end"],
          sample / 100,
        );
        expect(
          contrast(variables["--custom-page-text"], rendered),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each([
    ["#ffffff", "#ffffff"],
    ["#000000", "#000000"],
    ["#ffff00", "#ffffff"],
    ["#ffffff", "#000000"],
    ["#ff0000", "#0000ff"],
    ["#00ff00", "#ff00ff"],
  ])(
    "mantiene testo leggibile lungo la sfumatura %s → %s",
    (cardStart, cardEnd) => {
      const variables = styleVariables({
        ...originalStyle,
        cardStart,
        cardEnd,
      });
      const start = variables["--custom-card-start"];
      const end = variables["--custom-card-end"];
      expect(variables["--custom-card-bg"]).toBe(
        `linear-gradient(135deg, ${start}, ${end})`,
      );
      for (let sample = 0; sample <= 100; sample++) {
        const background = interpolateHex(start, end, sample / 100);
        expect(
          contrast(variables["--custom-card-text"], background),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(variables["--custom-card-muted"], background),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("conserva sfumature già leggibili e scurisce quelle incompatibili con un solo testo", () => {
    const original = styleVariables(originalStyle);
    expect(original["--custom-card-start"]).toBe(originalStyle.cardStart);
    expect(original["--custom-card-end"]).toBe(originalStyle.cardEnd);
    const repaired = styleVariables({
      ...originalStyle,
      cardStart: "#ffffff",
      cardEnd: "#000000",
    });
    expect(repaired["--custom-card-start"]).not.toBe("#ffffff");
    expect(repaired["--custom-card-end"]).toBe("#000000");
    expect(repaired["--custom-card-text"]).toBe("#ffffff");
    expect(contrastText("#ffffff")).toBe("#000000");
    expect(contrastText("#000000")).toBe("#ffffff");
  });

  it("salva più stili, aggiorna per ID e mantiene le altre creazioni", () => {
    const first = saveNamedStyle("Notte rossa", {
      ...originalStyle,
      brandPrimary: "#ff5252",
    });
    const second = saveNamedStyle(
      "Mare",
      themes.find((item) => item.id === "house")!.style,
    );
    expect(readStyleLibrary().map((item) => item.name)).toEqual([
      "Mare",
      "Notte rossa",
    ]);
    const updated = saveNamedStyle(
      "Notte rubino",
      { ...first.style, sidebarAuto: false, sidebar: "#110011" },
      first.id,
    );
    expect(updated.id).toBe(first.id);
    expect(readStyleLibrary()).toHaveLength(2);
    expect(readStyleLibrary().find((item) => item.id === second.id)).toEqual(
      second,
    );
    expect(readCustomStyle().savedStyleId).toBe(first.id);
    const copy = saveNamedStyle("Notte rubino", updated.style);
    expect(copy.id).not.toBe(first.id);
    expect(readStyleLibrary()).toHaveLength(3);
    expect(() => saveNamedStyle("  ", originalStyle)).toThrow();
    expect(readStyleLibrary()).toHaveLength(3);
  });

  it("i dieci preset usano colori esatti e lo stesso modello delle creazioni", () => {
    expect(themes.map((item) => item.color)).toEqual([
      "#FF8A3D",
      "#A56BFF",
      "#FF5FA2",
      "#A6C7A3",
      "#23DDC5",
      "#FFC857",
      "#5B8CFF",
      "#FF5252",
      "#DFFF00",
      "#A63D64",
    ]);
    for (const preset of themes) {
      saveCustomStyle(preset.style, true, { presetId: preset.id });
      expect(readCustomStyle().style).toEqual(preset.style);
      expect(readCustomStyle().presetId).toBe(preset.id);
      const tokens = styleVariables(preset.style);
      expect(tokens["--custom-brand-primary"]).toBe(preset.color.toLowerCase());
      expect(
        contrast(tokens["--custom-button-text"], preset.style.buttons),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("abbina la sidebar allo sfondo oppure mantiene i colori indipendenti scelti", () => {
    const base = styleVariables(originalStyle);
    const automatic = styleVariables({
      ...originalStyle,
      backgroundEnd: "#421122",
    });
    expect(automatic["--custom-sidebar-bg"]).not.toBe(
      base["--custom-sidebar-bg"],
    );
    const manual = {
      ...originalStyle,
      sidebarAuto: false,
      sidebar: "#ffffff",
      sidebarEnd: "#ffffcc",
    };
    expect(styleVariables(manual)["--custom-sidebar-bg"]).toBe(
      "linear-gradient(160deg, #ffffff, #ffffcc)",
    );
    expect(styleVariables(manual)["--custom-sidebar-text"]).toBe("#000000");
    expect(
      styleVariables({ ...manual, backgroundEnd: "#421122" })[
        "--custom-sidebar-bg"
      ],
    ).toBe(styleVariables(manual)["--custom-sidebar-bg"]);
  });
});
