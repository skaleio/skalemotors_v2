export type LeadContactState = "prioridad" | "interesado" | "filtrar";

export const LEAD_CONTACT_STATE_OPTIONS: LeadContactState[] = [
  "prioridad",
  "interesado",
  "filtrar",
];

export const LEAD_CONTACT_STATE_LABELS: Record<LeadContactState, string> = {
  prioridad: "Prioridad",
  interesado: "Interesado",
  filtrar: "Filtrar",
};

export const LEAD_CONTACT_STATE_HINTS: Record<LeadContactState, string> = {
  prioridad: "Contactar con máxima prioridad",
  interesado: "Lead con interés real; dar seguimiento",
  filtrar: "Baja prioridad o descartar del foco inmediato",
};

/** Estilo esquina Kanban (similar a etiqueta de vendedor). */
export const LEAD_CONTACT_STATE_BADGE_CLASS: Record<LeadContactState, string> = {
  prioridad:
    "border-red-300/80 bg-red-50 text-red-800 dark:border-red-700/60 dark:bg-red-950/50 dark:text-red-200",
  interesado:
    "border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  filtrar:
    "border-slate-300/80 bg-slate-100 text-slate-700 dark:border-slate-600/60 dark:bg-slate-900/50 dark:text-slate-300",
};

const STATE_SET = new Set<string>(LEAD_CONTACT_STATE_OPTIONS);

export function parseLeadContactState(value: unknown): LeadContactState | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).toLowerCase().trim();
  return STATE_SET.has(s) ? (s as LeadContactState) : null;
}

export function contactStateToPriority(state: LeadContactState): "baja" | "media" | "alta" {
  if (state === "prioridad") return "alta";
  if (state === "filtrar") return "baja";
  return "media";
}

export function canSetLeadContactState(role: string | null | undefined): boolean {
  return role === "admin";
}
