import {
  mix,
  originalStyle,
  type CustomStyle,
} from "../services/appearance/customStyle.ts";

const palettes = [
  ["rap", "Rap", "#FF8A3D", "Calore urbano, riflessi arancio"],
  ["trap", "Trap", "#A56BFF", "Viola elettrico, profondità notturna"],
  ["pop", "Pop", "#FF5FA2", "Rosa acceso, energia luminosa"],
  ["indie", "Indie", "#A6C7A3", "Verde salvia, atmosfera morbida"],
  ["house", "House", "#23DDC5", "Turchese liquido, ritmo continuo"],
  ["reggaeton", "Reggaeton", "#FFC857", "Oro caldo, luce tropicale"],
  ["techno", "Techno", "#5B8CFF", "Blu intenso, riflessi metallici"],
  ["rock", "Rock", "#FF5252", "Rosso deciso, ombre profonde"],
  ["dance", "Dance", "#DFFF00", "Lime luminoso, energia in movimento"],
  ["rnb", "R&B", "#A63D64", "Bordeaux vellutato, luce soffusa"],
] as const;

const genreThemes = palettes.map(([id, name, color, mood]) => {
  const primary = color.toLowerCase();
  const style: CustomStyle = {
    ...originalStyle,
    background: mix(primary, "#0b0d10", 0.06),
    backgroundEnd: mix(primary, "#0b0d10", 0.2),
    cardStart: mix(primary, "#17191e", 0.24),
    cardEnd: mix(primary, "#17191e", 0.08),
    buttons: primary,
    brandPrimary: primary,
    brandSecondary: mix(primary, "#090b10", 0.32),
    sidebarAuto: true,
  };
  return { id, name, color, mood, style };
});

export const themes = [
  {
    id: "nextwave",
    name: "NextWave",
    color: "#A3FF12",
    mood: "Il logo originale: viola profondo e lime luminoso",
    style: {
      ...originalStyle,
      background: "#101112",
      backgroundEnd: "#1d1230",
      cardStart: "#2a1b40",
      cardEnd: "#192219",
      buttons: originalStyle.brandPrimary,
      sidebarAuto: true,
    },
  },
  ...genreThemes,
];

export function defaultTheme(id: string) {
  const migrated = id === "pulse" ? "dance" : id === "jazz" ? "reggaeton" : id;
  return themes.find((theme) => theme.id === migrated) ?? genreThemes[8];
}
