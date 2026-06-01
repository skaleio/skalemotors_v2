// Motor de temas y tokens de la vitrina pública (Enfoque A: design tokens + CSS vars).
// Función pura buildTokens(site) -> DesignTokens. El mismo motor alimenta el preview
// del editor y la web pública, garantizando render idéntico.

export type ThemeId = "moderna" | "tradicional" | "premium" | "miami";
export type FontId =
  | "poppins-inter"
  | "playfair-lora"
  | "montserrat-roboto"
  | "space-inter";

export interface DesignTokens {
  colorBg: string;
  colorSurface: string;
  colorFg: string;
  colorMuted: string;
  colorPrimary: string;
  colorPrimaryFg: string;
  colorSecondary: string;
  colorBorder: string;
  fontHeading: string;
  fontBody: string;
  radius: string;
  shadow: string;
  spaceSection: string;
}

/** Datos mínimos del sitio que el motor necesita. Subconjunto de tenant_sites. */
export interface ThemeableSite {
  theme?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  font?: string | null;
}

interface FontPair {
  label: string;
  heading: string;
  body: string;
  /** Familias para el <link> de Google Fonts (formato querystring family=...). */
  googleFamilies: string[];
}

const SYSTEM_FALLBACK =
  "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF_FALLBACK = "Georgia, 'Times New Roman', serif";

export const FONT_PAIRS: Record<FontId, FontPair> = {
  "poppins-inter": {
    label: "Poppins + Inter",
    heading: `'Poppins', ${SYSTEM_FALLBACK}`,
    body: `'Inter', ${SYSTEM_FALLBACK}`,
    googleFamilies: ["Poppins:wght@500;600;700", "Inter:wght@400;500;600"],
  },
  "playfair-lora": {
    label: "Playfair + Lora",
    heading: `'Playfair Display', ${SERIF_FALLBACK}`,
    body: `'Lora', ${SERIF_FALLBACK}`,
    googleFamilies: ["Playfair+Display:wght@600;700", "Lora:wght@400;500"],
  },
  "montserrat-roboto": {
    label: "Montserrat + Roboto",
    heading: `'Montserrat', ${SYSTEM_FALLBACK}`,
    body: `'Roboto', ${SYSTEM_FALLBACK}`,
    googleFamilies: ["Montserrat:wght@600;700", "Roboto:wght@400;500"],
  },
  "space-inter": {
    label: "Space Grotesk + Inter",
    heading: `'Space Grotesk', ${SYSTEM_FALLBACK}`,
    body: `'Inter', ${SYSTEM_FALLBACK}`,
    googleFamilies: ["Space+Grotesk:wght@500;600;700", "Inter:wght@400;500;600"],
  },
};

const DEFAULT_FONT_BY_THEME: Record<ThemeId, FontId> = {
  moderna: "poppins-inter",
  tradicional: "playfair-lora",
  premium: "montserrat-roboto",
  miami: "montserrat-roboto",
};

export const THEME_PRESETS: Record<ThemeId, DesignTokens> = {
  moderna: {
    colorBg: "#ffffff",
    colorSurface: "#f8fafc",
    colorFg: "#0f172a",
    colorMuted: "#64748b",
    colorPrimary: "#7c3aed",
    colorPrimaryFg: "#ffffff",
    colorSecondary: "#0ea5e9",
    colorBorder: "#e2e8f0",
    fontHeading: FONT_PAIRS["poppins-inter"].heading,
    fontBody: FONT_PAIRS["poppins-inter"].body,
    radius: "0.75rem",
    shadow: "0 1px 3px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.06)",
    spaceSection: "4rem",
  },
  tradicional: {
    colorBg: "#ffffff",
    colorSurface: "#faf7f2",
    colorFg: "#1c1917",
    colorMuted: "#78716c",
    colorPrimary: "#b45309",
    colorPrimaryFg: "#ffffff",
    colorSecondary: "#d9b382",
    colorBorder: "#e7e5e4",
    fontHeading: FONT_PAIRS["playfair-lora"].heading,
    fontBody: FONT_PAIRS["playfair-lora"].body,
    radius: "0.25rem",
    shadow: "0 1px 2px rgba(28,25,23,0.10)",
    spaceSection: "3.5rem",
  },
  premium: {
    colorBg: "#0b0b0f",
    colorSurface: "#15151c",
    colorFg: "#f5f5f7",
    colorMuted: "#a1a1aa",
    colorPrimary: "#c8a24a",
    colorPrimaryFg: "#0b0b0f",
    colorSecondary: "#f5f5f7",
    colorBorder: "#26262e",
    fontHeading: FONT_PAIRS["montserrat-roboto"].heading,
    fontBody: FONT_PAIRS["montserrat-roboto"].body,
    radius: "0.5rem",
    shadow: "0 10px 30px rgba(0,0,0,0.45)",
    spaceSection: "5rem",
  },
  /** Estilo Roadify: fondo negro, acentos rosado Miami Motors (editable con color primario). */
  miami: {
    colorBg: "#0a0a0a",
    colorSurface: "#141418",
    colorFg: "#ffffff",
    colorMuted: "#a1a1aa",
    colorPrimary: "#ec4899",
    colorPrimaryFg: "#ffffff",
    colorSecondary: "#f9a8d4",
    colorBorder: "#2a2a30",
    fontHeading: FONT_PAIRS["montserrat-roboto"].heading,
    fontBody: FONT_PAIRS["montserrat-roboto"].body,
    radius: "0.75rem",
    shadow: "0 16px 48px rgba(0,0,0,0.55)",
    spaceSection: "5rem",
  },
};

export const THEME_OPTIONS: { id: ThemeId; label: string; description: string }[] = [
  { id: "miami", label: "Miami", description: "Oscura, rosado y blanco — estilo vitrina premium" },
  { id: "moderna", label: "Moderna", description: "Limpia, clara, bordes redondeados" },
  { id: "tradicional", label: "Tradicional", description: "Serif editorial, sobria" },
  { id: "premium", label: "Premium", description: "Oscura, dorada, espaciosa" },
];

/** Temas con layout tipo Roadify (header sticky, hero cinematográfico, cards oscuras). */
export function isLuxuryTheme(theme: string | null | undefined): boolean {
  return theme === "miami" || theme === "premium";
}

export function isThemeId(value: unknown): value is ThemeId {
  return (
    value === "moderna" ||
    value === "tradicional" ||
    value === "premium" ||
    value === "miami"
  );
}

export function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && value in FONT_PAIRS;
}

/**
 * Normaliza un color hex (#rgb o #rrggbb) a {r,g,b}. Devuelve null si no es válido.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/**
 * Devuelve "#000" o "#fff" según el color de fondo, usando luminancia relativa (WCAG).
 * Fallback "#fff" si el color es inválido.
 */
export function readableFg(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L =
    0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
  // Umbral 0.179 ≈ punto donde el contraste con negro supera al de blanco.
  return L > 0.179 ? "#000000" : "#ffffff";
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Construye los tokens finales: preset del tema + overrides de marca.
 * Función pura, nunca lanza. Tema desconocido → 'moderna'.
 */
export function buildTokens(site: ThemeableSite | null | undefined): DesignTokens {
  const themeId: ThemeId = isThemeId(site?.theme) ? site!.theme : "moderna";
  const base = THEME_PRESETS[themeId];
  const tokens: DesignTokens = { ...base };

  if (isNonEmpty(site?.primary_color) && hexToRgb(site!.primary_color!)) {
    tokens.colorPrimary = site!.primary_color!;
    tokens.colorPrimaryFg = readableFg(site!.primary_color!);
  }

  if (isNonEmpty(site?.secondary_color) && hexToRgb(site!.secondary_color!)) {
    tokens.colorSecondary = site!.secondary_color!;
  }

  const fontId: FontId = isFontId(site?.font)
    ? (site!.font as FontId)
    : DEFAULT_FONT_BY_THEME[themeId];
  tokens.fontHeading = FONT_PAIRS[fontId].heading;
  tokens.fontBody = FONT_PAIRS[fontId].body;

  return tokens;
}

/** Familias Google Fonts necesarias para el sitio (para montar el <link>). */
export function googleFontsHref(site: ThemeableSite | null | undefined): string {
  const themeId: ThemeId = isThemeId(site?.theme) ? site!.theme : "moderna";
  const fontId: FontId = isFontId(site?.font)
    ? (site!.font as FontId)
    : DEFAULT_FONT_BY_THEME[themeId];
  const families = FONT_PAIRS[fontId].googleFamilies
    .map((f) => `family=${f}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Convierte tokens a variables CSS (--sm-*) para inyección inline. */
export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
  return {
    "--sm-bg": tokens.colorBg,
    "--sm-surface": tokens.colorSurface,
    "--sm-fg": tokens.colorFg,
    "--sm-muted": tokens.colorMuted,
    "--sm-primary": tokens.colorPrimary,
    "--sm-primary-fg": tokens.colorPrimaryFg,
    "--sm-secondary": tokens.colorSecondary,
    "--sm-border": tokens.colorBorder,
    "--sm-font-heading": tokens.fontHeading,
    "--sm-font-body": tokens.fontBody,
    "--sm-radius": tokens.radius,
    "--sm-shadow": tokens.shadow,
    "--sm-space-section": tokens.spaceSection,
  };
}
