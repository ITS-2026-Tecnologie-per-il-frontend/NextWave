export const originalStyle = {
  background: "#101112",
  backgroundEnd: "#1b2435",
  cardStart: "#242035",
  cardEnd: "#18242b",
  buttons: "#ccff5f",
  sidebarAuto: true,
  sidebar: "#121314",
  sidebarEnd: "#1b2435",
  brandPrimary: "#a3ff12",
  brandSecondary: "#7f12d7",
  radius: 14,
  font: "Space Grotesk",
  shadow: 12,
};

export type CustomStyle = typeof originalStyle;
const key = "nextwave-custom-style-v1";
const fonts = ["Space Grotesk", "Arial", "Georgia"];
const minimumContrast = 4.5;
type RGB = [number, number, number];

function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function normalizeStyle(value: unknown): CustomStyle | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  // Retain existing saved styles while replacing ambiguous color controls.
  const background = source.background;
  const backgroundEnd =
    source.backgroundEnd === undefined ? background : source.backgroundEnd;
  const cardStart =
    source.cardStart === undefined ? source.panel : source.cardStart;
  const cardEnd =
    source.cardEnd === undefined ? source.secondary : source.cardEnd;
  const buttons = source.buttons === undefined ? source.accent : source.buttons;
  const sidebarAuto =
    source.sidebarAuto === undefined ? true : source.sidebarAuto;
  const sidebar =
    source.sidebar === undefined ? originalStyle.sidebar : source.sidebar;
  const sidebarEnd =
    source.sidebarEnd === undefined
      ? originalStyle.sidebarEnd
      : source.sidebarEnd;
  const brandPrimary =
    source.brandPrimary === undefined
      ? originalStyle.brandPrimary
      : source.brandPrimary;
  const brandSecondary =
    source.brandSecondary === undefined
      ? originalStyle.brandSecondary
      : source.brandSecondary;
  const { radius, font, shadow } = source;
  if (
    !isHex(background) ||
    !isHex(backgroundEnd) ||
    !isHex(cardStart) ||
    !isHex(cardEnd) ||
    !isHex(buttons) ||
    typeof sidebarAuto !== "boolean" ||
    !isHex(sidebar) ||
    !isHex(sidebarEnd) ||
    !isHex(brandPrimary) ||
    !isHex(brandSecondary) ||
    typeof font !== "string" ||
    !fonts.includes(font) ||
    typeof radius !== "number" ||
    !Number.isFinite(radius) ||
    radius < 0 ||
    radius > 32 ||
    typeof shadow !== "number" ||
    !Number.isFinite(shadow) ||
    shadow < 0 ||
    shadow > 30
  )
    return null;
  return {
    background: background.toLowerCase(),
    backgroundEnd: backgroundEnd.toLowerCase(),
    cardStart: cardStart.toLowerCase(),
    cardEnd: cardEnd.toLowerCase(),
    buttons: buttons.toLowerCase(),
    sidebarAuto,
    sidebar: sidebar.toLowerCase(),
    sidebarEnd: sidebarEnd.toLowerCase(),
    brandPrimary: brandPrimary.toLowerCase(),
    brandSecondary: brandSecondary.toLowerCase(),
    radius,
    font,
    shadow,
  };
}

export interface StyleSelection {
  presetId?: string;
  savedStyleId?: string;
}
export function readCustomStyle(): StyleSelection & {
  active: boolean;
  style: CustomStyle;
} {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    const style = normalizeStyle(saved?.style);
    if (style)
      return {
        active: saved.active === true,
        style,
        ...(typeof saved.presetId === "string"
          ? { presetId: saved.presetId }
          : {}),
        ...(typeof saved.savedStyleId === "string"
          ? { savedStyleId: saved.savedStyleId }
          : {}),
      };
  } catch {
    /* Default if storage is unavailable or invalid. */
  }
  return { active: false, style: { ...originalStyle } };
}

function rgb(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function luminance(color: RGB): number {
  const linear = color.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(rgb(foreground));
  const b = luminance(rgb(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function interpolate(a: RGB, b: RGB, amount: number): RGB {
  return a.map((channel, i) => channel + (b[i] - channel) * amount) as RGB;
}

export function mix(
  foreground: string,
  background: string,
  amount: number,
): string {
  return `#${interpolate(rgb(background), rgb(foreground), amount)
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function contrastText(hex: string): string {
  const background = isHex(hex) ? hex : originalStyle.background;
  return contrast("#000000", background) >= contrast("#ffffff", background)
    ? "#000000"
    : "#ffffff";
}

function readableGradient(start: string, end: string) {
  const a = rgb(start);
  const b = rgb(end);
  // sRGB luminance is convex: its maximum is at an endpoint, but its minimum
  // can occur between two differently colored endpoints.
  let low = 0;
  let high = 1;
  for (let i = 0; i < 48; i++) {
    const first = low + (high - low) / 3;
    const second = high - (high - low) / 3;
    if (
      luminance(interpolate(a, b, first)) < luminance(interpolate(a, b, second))
    )
      high = second;
    else low = first;
  }
  const darkest = Math.min(
    luminance(a),
    luminance(b),
    luminance(interpolate(a, b, (low + high) / 2)),
  );
  const lightest = Math.max(luminance(a), luminance(b));
  const blackContrast = (darkest + 0.05) / 0.05;
  const whiteContrast = 1.05 / (lightest + 0.05);
  if (Math.max(blackContrast, whiteContrast) >= minimumContrast) {
    return {
      start,
      end,
      text: blackContrast >= whiteContrast ? "#000000" : "#ffffff",
    };
  }
  // A white-to-black gradient cannot support one readable text color. Apply
  // a shared black scrim to both stops so the rendered gradient stays safe.
  for (let amount = 1; amount <= 100; amount++) {
    const safeStart = mix("#000000", start, amount / 100);
    const safeEnd = mix("#000000", end, amount / 100);
    if (
      Math.min(contrast("#ffffff", safeStart), contrast("#ffffff", safeEnd)) >=
      minimumContrast
    )
      return { start: safeStart, end: safeEnd, text: "#ffffff" };
  }
  return { start: "#000000", end: "#000000", text: "#ffffff" };
}

function playerColor(color: string): string {
  // Keep the chosen hue, lifting only colors that disappear into the player
  // or the unfilled track. The button itself retains the exact chosen color.
  for (let amount = 0; amount <= 100; amount++) {
    const candidate = mix("#ffffff", color, amount / 100);
    if (
      contrast(candidate, "#121314") >= 3 &&
      contrast(candidate, "#49484e") >= 3
    )
      return candidate;
  }
  return "#ffffff";
}

export function styleVariables(style: CustomStyle): Record<string, string> {
  const s = normalizeStyle(style) ?? originalStyle;
  const page = readableGradient(s.background, s.backgroundEnd);
  const card = readableGradient(s.cardStart, s.cardEnd);
  const sidebar = readableGradient(
    s.sidebarAuto ? mix("#000000", page.start, 0.22) : s.sidebar,
    s.sidebarAuto ? mix("#000000", page.end, 0.22) : s.sidebarEnd,
  );
  return {
    "--custom-page-start": page.start,
    "--custom-page-end": page.end,
    "--custom-page-bg": `linear-gradient(135deg, ${page.start}, ${page.end})`,
    "--custom-page-text": page.text,
    "--custom-page-muted": page.text,
    "--custom-page-line": mix(page.text, page.start, 0.25),
    "--custom-card-start": card.start,
    "--custom-card-end": card.end,
    "--custom-card-bg": `linear-gradient(135deg, ${card.start}, ${card.end})`,
    "--custom-card-text": card.text,
    "--custom-card-muted": card.text,
    "--custom-card-line": mix(card.text, mix(card.start, card.end, 0.5), 0.2),
    "--custom-button": s.buttons,
    "--custom-button-text": contrastText(s.buttons),
    "--custom-button-edge": mix(contrastText(s.buttons), s.buttons, 0.6),
    "--custom-control-bg": mix(s.buttons, "#202127", 0.08),
    "--custom-control-text": "#f5f4f7",
    "--custom-player-color": playerColor(s.buttons),
    "--custom-sidebar-bg": `linear-gradient(160deg, ${sidebar.start}, ${sidebar.end})`,
    "--custom-sidebar-text": sidebar.text,
    "--custom-sidebar-line": mix(sidebar.text, sidebar.start, 0.3),
    "--custom-brand-primary": s.brandPrimary,
    "--custom-brand-secondary": s.brandSecondary,
    "--custom-radius": `${s.radius}px`,
    "--custom-font": s.font,
    "--custom-shadow": `0 ${s.shadow / 2}px ${s.shadow * 2}px #0003`,
  };
}

export function saveCustomStyle(
  style: CustomStyle,
  active: boolean,
  selection: StyleSelection = {},
) {
  const normalized = normalizeStyle(style);
  if (!normalized) throw new TypeError("Stile personalizzato non valido");
  localStorage.setItem(
    key,
    JSON.stringify({ style: normalized, active, ...selection }),
  );
  window.dispatchEvent(new Event("nextwave-style"));
}

export interface SavedStyle {
  id: string;
  name: string;
  style: CustomStyle;
  updatedAt: string;
}
const libraryKey = "nextwave-style-library-v1";
export function readStyleLibrary(): SavedStyle[] {
  try {
    const values: unknown = JSON.parse(
      localStorage.getItem(libraryKey) || "[]",
    );
    if (!Array.isArray(values)) return [];
    return values.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const style = normalizeStyle(entry.style);
      if (
        !style ||
        typeof entry.id !== "string" ||
        typeof entry.name !== "string" ||
        !entry.name.trim()
      )
        return [];
      return [
        {
          id: entry.id,
          name: entry.name.trim().slice(0, 40),
          style,
          updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : "",
        },
      ];
    });
  } catch {
    return [];
  }
}
export function saveNamedStyle(
  name: string,
  style: CustomStyle,
  id?: string,
): SavedStyle {
  const normalized = normalizeStyle(style);
  if (!normalized || !name.trim())
    throw new TypeError("Dai un nome al tuo stile.");
  const library = readStyleLibrary();
  const existing = library.find((entry) => entry.id === id);
  const entry = {
    id: existing?.id ?? crypto.randomUUID(),
    name: name.trim().slice(0, 40),
    style: normalized,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(
    libraryKey,
    JSON.stringify([entry, ...library.filter((item) => item.id !== entry.id)]),
  );
  saveCustomStyle(normalized, true, { savedStyleId: entry.id });
  return entry;
}
