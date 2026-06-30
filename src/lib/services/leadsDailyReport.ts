// Informe diario consolidado de leads para gerencia.
// Se calcula AL VUELO desde la tabla `leads` (sin tabla/snapshot propio): foto del
// pipeline actual + métricas del día elegido. RLS ya acota por tenant; branchId es opcional.

import { supabase } from "../supabase";
import {
  getLeadCrmStageKey,
  CRM_PIPELINE_STAGES,
  CRM_PIPELINE_STATUS_LABELS,
  CRM_PIPELINE_ACTIVE_DB_STATUSES,
  type CrmStageKey,
} from "../crmPipeline";

export type LeadsDailyConsolidated = {
  date: string; // YYYY-MM-DD (Chile)
  scopeLabel: string;
  totalLeads: number;
  resumen: { nuevosHoy: number; activos: number; cerradosHoy: number };
  porEtapa: { label: string; count: number }[];
  porFuente: { label: string; count: number }[];
  alertas: { prioridadSinContactar: number; sinAsignar: number; seguimientosVencidos: number };
};

type LeadRow = {
  status: string | null;
  source: string | null;
  assigned_to: string | null;
  branch_id: string | null;
  created_at: string | null;
  closed_at: string | null;
  status_changed_at: string | null;
  contact_state: string | null;
  last_contact_at: string | null;
  next_follow_up: string | null;
};

/** Fecha local de Chile (YYYY-MM-DD) de un ISO; null si no hay fecha. */
function chileDateKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

export function chileTodayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function sourceLabel(source: string | null): string {
  const s = (source ?? "").trim();
  if (!s) return "Sin fuente";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isActive(status: string | null): boolean {
  return CRM_PIPELINE_ACTIVE_DB_STATUSES.has((status ?? "").trim().toLowerCase());
}

export async function buildLeadsDailyConsolidated(params: {
  date?: string;
  branchId?: string | null;
  scopeLabel?: string;
}): Promise<LeadsDailyConsolidated> {
  const date = params.date ?? chileTodayKey();

  let query = supabase
    .from("leads")
    .select(
      "status, source, assigned_to, branch_id, created_at, closed_at, status_changed_at, contact_state, last_contact_at, next_follow_up"
    )
    .is("deleted_at", null);

  if (params.branchId) query = query.eq("branch_id", params.branchId);

  const { data, error } = await query;
  if (error) throw error;
  const leads = (data ?? []) as LeadRow[];

  const resumen = { nuevosHoy: 0, activos: 0, cerradosHoy: 0 };
  const alertas = { prioridadSinContactar: 0, sinAsignar: 0, seguimientosVencidos: 0 };
  const etapaCounts = new Map<CrmStageKey, number>();
  const fuenteCounts = new Map<string, number>();

  for (const lead of leads) {
    const status = (lead.status ?? "").trim().toLowerCase();
    const active = isActive(status);

    if (chileDateKey(lead.created_at) === date) resumen.nuevosHoy++;
    if (active) resumen.activos++;
    if (status === "vendido" && chileDateKey(lead.closed_at ?? lead.status_changed_at) === date) {
      resumen.cerradosHoy++;
    }

    if (active) {
      const stage = getLeadCrmStageKey(status);
      if (stage && stage !== "negocio_cerrado" && stage !== "cancelado") {
        etapaCounts.set(stage, (etapaCounts.get(stage) ?? 0) + 1);
      }

      const fuente = sourceLabel(lead.source);
      fuenteCounts.set(fuente, (fuenteCounts.get(fuente) ?? 0) + 1);

      if (lead.contact_state === "prioridad" && !lead.last_contact_at) {
        alertas.prioridadSinContactar++;
      }
      if (!lead.assigned_to) alertas.sinAsignar++;
      const followKey = chileDateKey(lead.next_follow_up);
      if (followKey && followKey < date) alertas.seguimientosVencidos++;
    }
  }

  // Etapas en orden del embudo (solo activas), excluyendo las vacías.
  const porEtapa = CRM_PIPELINE_STAGES.filter(
    (s) => s.key !== "negocio_cerrado" && s.key !== "cancelado"
  )
    .map((s) => ({ label: CRM_PIPELINE_STATUS_LABELS[s.key], count: etapaCounts.get(s.key) ?? 0 }))
    .filter((s) => s.count > 0);

  const porFuente = [...fuenteCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    date,
    scopeLabel: params.scopeLabel ?? (params.branchId ? "Sucursal" : "Todas las sucursales"),
    totalLeads: leads.length,
    resumen,
    porEtapa,
    porFuente,
    alertas,
  };
}
