import { getLeadCrmStageKey } from "@/lib/crmPipeline";

export type LeadContactState = "prioridad" | "interesado" | "filtrar";

export const LEAD_CONTACT_STATE_OPTIONS: LeadContactState[] = [
  "prioridad",
  "interesado",
  "filtrar",
];

export const LEAD_CONTACT_STATE_LABELS: Record<LeadContactState, string> = {
  prioridad: "Prioridad",
  interesado: "Interesado",
  filtrar: "Por filtrar",
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

/** Roles que siempre ven la etiqueta si existe (supervisión / admin). */
const CONTACT_STATE_SUPERVISOR_ROLES = new Set([
  "admin",
  "gerente",
  "jefe_jefe",
  "jefe_sucursal",
  "financiero",
]);

export function canSetLeadContactState(role: string | null | undefined): boolean {
  return role === "admin";
}

/** Admin siempre; vendedor solo después de salir de Nuevo. */
export function canAssignLeadContactState(
  role: string | null | undefined,
  leadStatus: string | null | undefined,
): boolean {
  if (canSetLeadContactState(role)) return true;
  if (role === "vendedor") {
    return getLeadCrmStageKey(leadStatus) !== "nuevo";
  }
  return false;
}

/** Vendedor ve la etiqueta del admin solo mientras el lead está en Nuevo. */
export function shouldShowLeadContactStateBadge(
  lead: { status?: string | null; contact_state?: string | null },
  viewerRole: string | null | undefined,
): boolean {
  if (!parseLeadContactState(lead.contact_state)) return false;
  if (viewerRole && CONTACT_STATE_SUPERVISOR_ROLES.has(viewerRole)) return true;
  if (viewerRole === "vendedor") {
    return getLeadCrmStageKey(lead.status) === "nuevo";
  }
  return Boolean(parseLeadContactState(lead.contact_state));
}

/** Al mover fuera de Nuevo, el vendedor pierde la etiqueta delegada y califica de nuevo. */
export function shouldClearContactStateOnVendorExitNuevo(
  actorRole: string | null | undefined,
  fromStatus: string | null | undefined,
  toStatus: string | null | undefined,
): boolean {
  if (actorRole !== "vendedor") return false;
  return (
    getLeadCrmStageKey(fromStatus) === "nuevo"
    && getLeadCrmStageKey(toStatus) !== "nuevo"
  );
}

export function contactStateClearPatch(): {
  contact_state: null;
  priority: "media";
} {
  return { contact_state: null, priority: "media" };
}

/**
 * Al mover un lead de NUEVO a EN SEGUIMIENTO se reinicia el semáforo de intentos
 * de contacto (`contact_attempts` → 0): los intentos del primer contacto no se
 * arrastran a la etapa de seguimiento. Solo aplica a movimientos nuevos.
 */
export function shouldResetContactAttemptsOnMove(
  fromStatus: string | null | undefined,
  toStatus: string | null | undefined,
): boolean {
  return (
    getLeadCrmStageKey(fromStatus) === "nuevo"
    && getLeadCrmStageKey(toStatus) === "en_seguimiento"
  );
}
