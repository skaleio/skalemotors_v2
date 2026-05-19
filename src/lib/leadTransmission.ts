/** Valores canónicos de transmisión en formularios de leads (CRM / Leads). */
export const LEAD_TRANSMISSION_OPTIONS = ["Manual", "Automático"] as const;

export type LeadTransmissionOption = (typeof LEAD_TRANSMISSION_OPTIONS)[number];

export const LEAD_TRANSMISSION_UNSET = "__lead_transmision_sin__";

function normalizeCanonical(raw: string): LeadTransmissionOption | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("man")) return "Manual";
  if (s.startsWith("auto") || s.includes("autom")) return "Automático";
  return null;
}

/** Valor inicial del formulario a partir del lead en BD. */
export function leadTransmissionForForm(raw?: string | null): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  return normalizeCanonical(trimmed) ?? trimmed;
}

/** Valor del Select (incluye opción vacía y legacy). */
export function leadTransmissionToSelectValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return LEAD_TRANSMISSION_UNSET;
  const canonical = normalizeCanonical(trimmed);
  if (canonical) return canonical;
  return trimmed;
}

export function leadTransmissionFromSelectValue(selectValue: string): string {
  if (selectValue === LEAD_TRANSMISSION_UNSET) return "";
  return selectValue;
}

/** Valor a persistir en `leads.transmision`. */
export function leadTransmissionForSave(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeCanonical(trimmed) ?? trimmed;
}

export function isCanonicalLeadTransmission(value: string): value is LeadTransmissionOption {
  return (LEAD_TRANSMISSION_OPTIONS as readonly string[]).includes(value);
}
