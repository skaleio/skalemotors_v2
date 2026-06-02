import type { DesignTokens } from "./theme";

/** Campos editables en el panel de diseño (primario/secundario van en columnas dedicadas). */
export const THEME_CUSTOM_KEYS = [
  "colorBg",
  "colorSurface",
  "colorFg",
  "colorMuted",
  "colorPrimaryFg",
  "colorBorder",
  "radius",
] as const;

export type ThemeCustomKey = (typeof THEME_CUSTOM_KEYS)[number];
export type ThemeCustomOverrides = Partial<Pick<DesignTokens, ThemeCustomKey>>;

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHex(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!HEX_RE.test(withHash)) return undefined;
  if (withHash.length === 4) {
    const h = withHash.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return withHash.toLowerCase();
}

function normalizeRadius(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const v = value.trim();
  if (/^\d+(\.\d+)?(rem|px|%)$/.test(v)) return v;
  return undefined;
}

/** Parsea tenant_sites.theme_custom desde la BD. */
export function parseThemeCustom(raw: unknown): ThemeCustomOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: ThemeCustomOverrides = {};

  for (const key of THEME_CUSTOM_KEYS) {
    const val = src[key];
    if (key === "radius") {
      const r = normalizeRadius(val);
      if (r) out.radius = r;
    } else {
      const hex = normalizeHex(val);
      if (hex) out[key] = hex;
    }
  }

  return out;
}

export function isEmptyThemeCustom(overrides: ThemeCustomOverrides): boolean {
  return THEME_CUSTOM_KEYS.every((k) => overrides[k] == null);
}

/** Objeto listo para jsonb en Supabase (sin claves vacías). */
export function serializeThemeCustom(overrides: ThemeCustomOverrides): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of THEME_CUSTOM_KEYS) {
    const val = overrides[key];
    if (val != null && String(val).trim()) out[key] = String(val).trim();
  }
  return out;
}

export const RADIUS_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "sharp", label: "Rectas", value: "0.125rem" },
  { id: "soft", label: "Suaves", value: "0.5rem" },
  { id: "round", label: "Redondeadas", value: "0.75rem" },
  { id: "pill", label: "Muy redondas", value: "1rem" },
];

export function radiusPresetId(value: string | undefined): string {
  if (!value) return "";
  const hit = RADIUS_PRESETS.find((p) => p.value === value);
  return hit?.id ?? "custom";
}
