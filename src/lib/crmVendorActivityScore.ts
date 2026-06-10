import type { SellerEngagementRow } from "@/lib/sellerEngagement";
import { engagementScoreLabel } from "@/lib/sellerEngagement";

/** Ventana de actividad CRM (alineada con get_seller_engagement_metrics). */
export const CRM_ACTIVITY_WINDOW_DAYS = 7;

/** Horas sin tocar un lead abierto antes de considerarlo estancado. */
export const CRM_STALE_LEAD_HOURS = 48;

const CONSIGNACION_TAG_PREFIX = "consignacion:";
const CLOSED_STATUSES = new Set(["vendido", "perdido", "cancelado"]);

export type CrmLeadActivityInput = {
  assigned_to: string | null;
  status: string | null;
  tags: unknown;
  updated_at?: string | null;
  status_changed_at?: string | null;
  contact_attempts?: number | null;
  last_contact_at?: string | null;
};

export type CrmVendorActivityMetrics = {
  totalLeads: number;
  openLeads: number;
  /** Leads con actividad reciente en la ventana (mueve, edita, contacta). */
  recentTouches: number;
  /** Leads abiertos sin actividad hace más de CRM_STALE_LEAD_HOURS. */
  staleOpenLeads: number;
  /** Movimientos de pipeline detectados en ventana (desde leads + RPC). */
  pipelineMoves: number;
  notesCount: number;
  activitiesCount: number;
  contactTouches: number;
};

export type CrmVendorActivityScore = CrmVendorActivityMetrics & {
  vendorId: string;
  /** 0–100: sube con movimientos/notas/contactos; baja con leads estancados. */
  activityScore: number;
  activityLabel: string;
  isInactive: boolean;
};

function normalizeTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed.map(String) : [tags];
    } catch {
      return [tags];
    }
  }
  return [];
}

function isConsignacionLead(lead: CrmLeadActivityInput): boolean {
  return normalizeTags(lead.tags).some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
}

function isOpenLead(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s.length > 0 && !CLOSED_STATUSES.has(s);
}

function parseTs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Última actividad real del vendedor sobre el lead.
 * Excluye `updated_at` (asignación/delegación admin no cuenta como actividad).
 */
export function vendorLeadActivityAt(lead: CrmLeadActivityInput): number | null {
  const candidates = [
    parseTs(lead.status_changed_at),
    parseTs(lead.last_contact_at),
  ].filter((t): t is number => t != null);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/** @deprecated Usar vendorLeadActivityAt — updated_at incluía asignaciones admin. */
export function leadLastActivityAt(lead: CrmLeadActivityInput): number | null {
  return vendorLeadActivityAt(lead);
}

function countContactTouchesInWindow(
  lead: CrmLeadActivityInput,
  windowStartMs: number,
): number {
  const attempts = lead.contact_attempts ?? 0;
  if (attempts <= 0) return 0;
  const lastContact = parseTs(lead.last_contact_at);
  if (lastContact != null && lastContact >= windowStartMs) return 1;
  return 0;
}

/**
 * Métricas CRM derivadas de los leads visibles + engagement del backend.
 *
 * Modelo de score (0–100):
 * + hasta 36 pts — leads trabajados en ventana (toques recientes)
 * + hasta 24 pts — movimientos de pipeline (cambio de estado en ventana; no asignaciones)
 * + hasta 20 pts — notas en leads
 * + hasta 12 pts — actividades registradas
 * + hasta 8 pts  — semáforos de contacto marcados en ventana
 * − hasta 40 pts — leads abiertos estancados (sin actividad > 48 h)
 */
export function computeVendorCrmActivityScore(input: {
  vendorId: string;
  leads: CrmLeadActivityInput[];
  engagement?: Pick<
    SellerEngagementRow,
    | "notes_count"
    | "activities_count"
    | "lead_moves_count"
    | "is_inactive"
    | "stale_assigned_leads"
  > | null;
  windowDays?: number;
  staleHours?: number;
  now?: Date;
}): CrmVendorActivityScore {
  const {
    vendorId,
    leads,
    engagement,
    windowDays = CRM_ACTIVITY_WINDOW_DAYS,
    staleHours = CRM_STALE_LEAD_HOURS,
    now = new Date(),
  } = input;

  const windowStartMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const staleStartMs = now.getTime() - staleHours * 60 * 60 * 1000;

  const assigned = leads.filter(
    (lead) => lead.assigned_to === vendorId && !isConsignacionLead(lead),
  );

  let recentTouches = 0;
  let staleOpenLeads = 0;
  let pipelineMovesFromLeads = 0;
  let contactTouches = 0;
  let openLeads = 0;

  for (const lead of assigned) {
    const open = isOpenLead(lead.status);
    if (open) openLeads += 1;

    const lastAt = vendorLeadActivityAt(lead);
    const touchedInWindow = lastAt != null && lastAt >= windowStartMs;
    if (touchedInWindow) {
      recentTouches += 1;
    }

    const statusChanged = parseTs(lead.status_changed_at);
    if (statusChanged != null && statusChanged >= windowStartMs) {
      pipelineMovesFromLeads += 1;
    }

    if (open && (lastAt == null || lastAt < staleStartMs)) {
      staleOpenLeads += 1;
    }

    contactTouches += countContactTouchesInWindow(lead, windowStartMs);
  }

  const notesCount = engagement?.notes_count ?? 0;
  const activitiesCount = engagement?.activities_count ?? 0;
  const pipelineMoves = Math.max(engagement?.lead_moves_count ?? 0, pipelineMovesFromLeads);

  const touchPoints = Math.min(recentTouches * 12, 36);
  const movePoints = Math.min(pipelineMoves * 8, 24);
  const notePoints = Math.min(notesCount * 10, 20);
  const activityPoints = Math.min(activitiesCount * 8, 12);
  const contactPoints = Math.min(contactTouches * 4, 8);
  const stalePenalty = Math.min(staleOpenLeads * 10, 40);

  const rawScore = touchPoints + movePoints + notePoints + activityPoints + contactPoints - stalePenalty;
  let activityScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  const isInactive =
    (engagement?.is_inactive ?? false)
    || (openLeads > 0 && recentTouches === 0 && staleOpenLeads >= openLeads);

  if (isInactive && activityScore > 25) {
    activityScore = 25;
  }

  return {
    vendorId,
    totalLeads: assigned.length,
    openLeads,
    recentTouches,
    staleOpenLeads,
    pipelineMoves,
    notesCount,
    activitiesCount,
    contactTouches,
    activityScore,
    activityLabel: engagementScoreLabel(activityScore),
    isInactive,
  };
}

export function formatCrmActivityBreakdown(metrics: CrmVendorActivityMetrics): string {
  return `${metrics.pipelineMoves} movimientos · ${metrics.recentTouches} leads tocados · ${metrics.notesCount} notas`;
}
