import { format } from "date-fns";

import { supabase } from "@/lib/supabase";
import type { ExportRow } from "@/lib/utils/exportXlsx";
import {
  countDailyReportProgress,
  normalizeDailySalesReportPayload,
  SELLER_ROLES_FOR_DAILY_REPORT,
} from "@/lib/types/dailySalesReport";
import type { DailySalesReportPayload } from "@/lib/types/dailySalesReport";

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "dd-MM-yyyy");
};

const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "dd-MM-yyyy HH:mm");
};

interface Lookups {
  userName: Map<string, string>;
  branchName: Map<string, string>;
}

async function fetchLookups(tenantId: string): Promise<Lookups> {
  const [{ data: users }, { data: branches }] = await Promise.all([
    supabase.from("users").select("id, full_name, email").eq("tenant_id", tenantId),
    supabase.from("branches").select("id, name").eq("tenant_id", tenantId),
  ]);

  const userName = new Map<string, string>(
    (users ?? []).map((u) => [u.id, u.full_name || u.email || "—"]),
  );
  const branchName = new Map<string, string>(
    (branches ?? []).map((b) => [b.id, b.name ?? "—"]),
  );
  return { userName, branchName };
}

export async function fetchDailyReportExportRows(
  tenantId: string,
  from: string,
  to: string,
): Promise<ExportRow[]> {
  const [{ data, error }, lookups] = await Promise.all([
    supabase
      .from("daily_sales_reports")
      .select("report_date, submitted_at, payload, user_id, branch_id")
      .eq("tenant_id", tenantId)
      .gte("report_date", from)
      .lte("report_date", to)
      .order("report_date", { ascending: true }),
    fetchLookups(tenantId),
  ]);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const payload = normalizeDailySalesReportPayload(
      row.payload as unknown as DailySalesReportPayload,
    );
    const progress = countDailyReportProgress(payload);
    return {
      Fecha: fmtDate(row.report_date),
      Vendedor: lookups.userName.get(row.user_id) ?? "—",
      Sucursal: row.branch_id ? lookups.branchName.get(row.branch_id) ?? "—" : "—",
      Estado: row.submitted_at ? "Enviado" : "Pendiente",
      "Hora envío": row.submitted_at ? fmtDateTime(row.submitted_at) : "",
      Llamados: progress.calls,
      Créditos: progress.credits,
      "Publicaciones RRSS": payload.social_media.total_posts ?? 0,
      "Vehículos a plataformas": progress.platforms,
      Observaciones: payload.daily_observations?.trim() ?? "",
    };
  });
}

export async function fetchConsignacionesExportRows(
  tenantId: string,
  from: string,
  to: string,
): Promise<ExportRow[]> {
  const [{ data, error }, lookups] = await Promise.all([
    supabase
      .from("consignaciones")
      .select(
        "fecha, created_at, owner_name, owner_phone, patente, vehicle_make, vehicle_model, vehicle_year, vehicle_km, consignacion_price, sale_price, status, publicado, created_by, branch_id",
      )
      .eq("tenant_id", tenantId)
      .gte("fecha", from)
      .lte("fecha", to)
      .order("fecha", { ascending: true }),
    fetchLookups(tenantId),
  ]);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    Fecha: fmtDate(row.fecha ?? row.created_at),
    Vendedor: row.created_by ? lookups.userName.get(row.created_by) ?? "—" : "—",
    Sucursal: row.branch_id ? lookups.branchName.get(row.branch_id) ?? "—" : "—",
    Dueño: row.owner_name ?? "",
    Teléfono: row.owner_phone ?? "",
    Patente: row.patente ?? "",
    Vehículo: [row.vehicle_make, row.vehicle_model, row.vehicle_year].filter(Boolean).join(" "),
    KM: row.vehicle_km ?? "",
    "Precio consignación": row.consignacion_price ?? "",
    "Precio venta": row.sale_price ?? "",
    Estado: row.status ?? "",
    Publicado: row.publicado ? "Sí" : "No",
  }));
}

export async function fetchLeadCallsExportRows(
  tenantId: string,
  from: string,
  to: string,
): Promise<ExportRow[]> {
  const [{ data, error }, lookups] = await Promise.all([
    supabase
      .from("lead_notes")
      .select("created_at, body, created_by, branch_id, lead:leads(full_name, phone)")
      .eq("tenant_id", tenantId)
      .eq("channel", "llamada")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: true }),
    fetchLookups(tenantId),
  ]);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const lead = row.lead as { full_name?: string; phone?: string } | null;
    return {
      Fecha: fmtDateTime(row.created_at),
      Vendedor: row.created_by ? lookups.userName.get(row.created_by) ?? "—" : "—",
      Sucursal: row.branch_id ? lookups.branchName.get(row.branch_id) ?? "—" : "—",
      Lead: lead?.full_name ?? "",
      Teléfono: lead?.phone ?? "",
      Nota: row.body ?? "",
    };
  });
}

export async function fetchContactCoverageExportRows(tenantId: string): Promise<ExportRow[]> {
  const [{ data: sellers, error: sellersError }, { data: leads, error: leadsError }, lookups] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, email, branch_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("daily_report_exempt", false)
        .in("role", [...SELLER_ROLES_FOR_DAILY_REPORT]),
      supabase
        .from("leads")
        .select("assigned_to, contact_attempts")
        .eq("tenant_id", tenantId)
        .not("assigned_to", "is", null),
      fetchLookups(tenantId),
    ]);
  if (sellersError) throw sellersError;
  if (leadsError) throw leadsError;

  const totals = new Map<string, { total: number; contacted: number }>();
  for (const lead of leads ?? []) {
    const uid = lead.assigned_to as string;
    const acc = totals.get(uid) ?? { total: 0, contacted: 0 };
    acc.total += 1;
    if ((lead.contact_attempts ?? 0) > 0) acc.contacted += 1;
    totals.set(uid, acc);
  }

  return (sellers ?? []).map((seller) => {
    const acc = totals.get(seller.id) ?? { total: 0, contacted: 0 };
    const pct = acc.total > 0 ? Math.round((acc.contacted / acc.total) * 100) : 0;
    return {
      Vendedor: seller.full_name || seller.email || "—",
      Sucursal: seller.branch_id ? lookups.branchName.get(seller.branch_id) ?? "—" : "—",
      "Leads asignados": acc.total,
      "Leads con intento de contacto": acc.contacted,
      "% cobertura": `${pct}%`,
      "Leads sin contactar": acc.total - acc.contacted,
    };
  });
}
