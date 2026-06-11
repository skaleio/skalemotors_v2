export const LEAD_CONTACT_URGENCY_MIN = 1;
export const LEAD_CONTACT_URGENCY_MAX = 5;
export const LEAD_CONTACT_URGENCY_DEFAULT = 3;

export type LeadContactUrgency = 1 | 2 | 3 | 4 | 5;

export const LEAD_CONTACT_URGENCY_LABELS: Record<LeadContactUrgency, string> = {
  1: "Muy baja",
  2: "Baja",
  3: "Media",
  4: "Alta",
  5: "Urgente",
};

export const LEAD_CONTACT_URGENCY_HINTS: Record<LeadContactUrgency, string> = {
  1: "Contactar cuando haya tiempo",
  2: "Seguimiento sin apuro",
  3: "Prioridad normal",
  4: "Priorizar hoy",
  5: "Contactar de inmediato",
};

const PILL_FILLED: Record<LeadContactUrgency, string> = {
  1: "bg-slate-400",
  2: "bg-sky-500",
  3: "bg-amber-500",
  4: "bg-orange-500",
  5: "bg-red-600",
};

const PILL_HOVER: Record<LeadContactUrgency, string> = {
  1: "hover:bg-slate-500",
  2: "hover:bg-sky-600",
  3: "hover:bg-amber-600",
  4: "hover:bg-orange-600",
  5: "hover:bg-red-700",
};

const BADGE_CLASS: Record<LeadContactUrgency, string> = {
  1: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300",
  2: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  3: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  4: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200",
  5: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300",
};

/** Devuelve null si el lead aún no tiene urgencia calificada. */
export function parseLeadContactUrgency(value: unknown): LeadContactUrgency | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(LEAD_CONTACT_URGENCY_MIN, Math.min(LEAD_CONTACT_URGENCY_MAX, Math.round(n)));
  return clamped as LeadContactUrgency;
}

export function clampLeadContactUrgency(value: unknown): LeadContactUrgency {
  return parseLeadContactUrgency(value) ?? (LEAD_CONTACT_URGENCY_DEFAULT as LeadContactUrgency);
}

export function contactUrgencyPillColors(level: LeadContactUrgency): { filled: string; hover: string } {
  return { filled: PILL_FILLED[level], hover: PILL_HOVER[level] };
}

export function contactUrgencyBadgeClass(level: LeadContactUrgency): string {
  return BADGE_CLASS[level];
}

/** Mantiene coherencia con el enum legacy `priority` del lead. */
export function contactUrgencyToPriority(level: LeadContactUrgency): "baja" | "media" | "alta" {
  if (level <= 2) return "baja";
  if (level >= 4) return "alta";
  return "media";
}

export function formatLeadContactUrgency(level: LeadContactUrgency): string {
  return `${level}/5 · ${LEAD_CONTACT_URGENCY_LABELS[level]}`;
}
