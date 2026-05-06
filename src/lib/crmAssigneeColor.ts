/** Paleta fija cuando el usuario no eligió `users.crm_color`. */
const FALLBACK_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#c026d3",
  "#ea580c",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
  "#be123c",
  "#0d9488",
  "#7c3aed",
] as const;

function isHexColor(v: string | null | undefined): v is string {
  return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
}

/** Color para borde/indicador del lead según el vendedor asignado. */
export function resolveAssigneeBorderColor(params: {
  userId: string | null | undefined;
  crmColor: string | null | undefined;
}): string | null {
  if (isHexColor(params.crmColor)) return params.crmColor;
  const id = params.userId?.trim();
  if (!id) return null;
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}

export const CRM_COLOR_PRESETS = [
  { label: "Azul", value: "#2563eb" },
  { label: "Verde", value: "#16a34a" },
  { label: "Violeta", value: "#7c3aed" },
  { label: "Rosa", value: "#db2777" },
  { label: "Naranja", value: "#ea580c" },
  { label: "Turquesa", value: "#0d9488" },
  { label: "Ámbar", value: "#d97706" },
  { label: "Rojo", value: "#dc2626" },
] as const;
