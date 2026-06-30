import { supabase } from "@/lib/supabase";
import type { DailyReportPdfData } from "@/lib/pdf/dailyReportPdf";
import type {
  DailyReportSupervisionRow,
  DailySalesReport,
  DailySalesReportPayload,
  LeadDailyCallRow,
} from "@/lib/types/dailySalesReport";
import {
  chileDayKey,
  chileMonthRange,
  chileTodayIsoDate,
  normalizeDailySalesReportPayload,
  SELLER_ROLES_FOR_DAILY_REPORT,
} from "@/lib/types/dailySalesReport";

function consignmentRowHasData(values: Record<string, unknown>): boolean {
  return Object.values(values).some((v) => String(v ?? "").trim() !== "");
}

export async function syncDailySalesReportTasks(reportDate?: string): Promise<number> {
  const { data, error } = await supabase.rpc("sync_daily_sales_report_tasks", {
    p_report_date: reportDate ?? chileTodayIsoDate(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { pending_tasks_created?: number } | null)?.pending_tasks_created ?? 0;
}

export async function fetchMyDailySalesReport(
  userId: string,
  reportDate: string,
): Promise<DailySalesReport | null> {
  const { data, error } = await supabase
    .from("daily_sales_reports")
    .select("*")
    .eq("user_id", userId)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    payload: normalizeDailySalesReportPayload(data.payload as DailySalesReportPayload),
  } as DailySalesReport;
}

export async function fetchDailySalesReportsForDate(
  tenantId: string,
  reportDate: string,
  branchId?: string | null,
): Promise<DailySalesReport[]> {
  let q = supabase
    .from("daily_sales_reports")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("report_date", reportDate)
    .not("submitted_at", "is", null);

  if (branchId) {
    q = q.eq("branch_id", branchId);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    payload: normalizeDailySalesReportPayload(row.payload as DailySalesReportPayload),
  })) as DailySalesReport[];
}

export async function fetchDailyReportById(reportId: string): Promise<DailySalesReport | null> {
  const { data, error } = await supabase
    .from("daily_sales_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    payload: normalizeDailySalesReportPayload(data.payload as DailySalesReportPayload),
  } as DailySalesReport;
}

export async function submitDailySalesReport(input: {
  tenantId: string;
  branchId: string | null;
  userId: string;
  reportDate: string;
  payload: DailySalesReportPayload;
  existingId?: string | null;
}): Promise<DailySalesReport> {
  const row = {
    tenant_id: input.tenantId,
    branch_id: input.branchId,
    user_id: input.userId,
    report_date: input.reportDate,
    payload: input.payload,
    submitted_at: new Date().toISOString(),
  };

  if (input.existingId) {
    const { data, error } = await supabase
      .from("daily_sales_reports")
      .update(row)
      .eq("id", input.existingId)
      .eq("user_id", input.userId)
      .select("*")
      .single();
    if (error) throw error;
    return {
      ...data,
      payload: normalizeDailySalesReportPayload(data.payload as DailySalesReportPayload),
    } as DailySalesReport;
  }

  const { data, error } = await supabase
    .from("daily_sales_reports")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;

  return {
    ...data,
    payload: normalizeDailySalesReportPayload(data.payload as DailySalesReportPayload),
  } as DailySalesReport;
}

export async function fetchMonthlyEffectiveConsignmentsCount(
  userId: string,
  today?: string,
): Promise<number> {
  const { start, endExclusive } = chileMonthRange(today);
  const { data, error } = await supabase
    .from("daily_sales_reports")
    .select("payload")
    .eq("user_id", userId)
    .gte("report_date", start)
    .lt("report_date", endExclusive);

  if (error) throw error;

  return (data ?? []).reduce((total, row) => {
    const payload = normalizeDailySalesReportPayload(
      row.payload as DailySalesReportPayload,
    );
    return total + payload.effective_consignments.filter((r) => consignmentRowHasData(r)).length;
  }, 0);
}

export async function fetchSubmittedReportPdfDataForDate(input: {
  tenantId: string;
  reportDate: string;
  branchId?: string | null;
  scope?: "branch" | "tenant";
}): Promise<DailyReportPdfData[]> {
  const reports = await fetchDailySalesReportsForDate(
    input.tenantId,
    input.reportDate,
    input.scope === "tenant" ? undefined : input.branchId,
  );
  if (reports.length === 0) return [];

  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, email, branch:branches(name)")
    .in(
      "id",
      reports.map((r) => r.user_id),
    );
  if (error) throw error;

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const leadCallsByUser = await fetchLeadsCallsForUsersDay({
    userIds: reports.map((r) => r.user_id),
    reportDate: input.reportDate,
  });

  return reports
    .map((r) => {
      const u = userMap.get(r.user_id);
      const branchJoin = u?.branch as { name?: string } | null | undefined;
      return {
        fullName: u?.full_name ?? u?.email ?? "Sin nombre",
        branchName: branchJoin?.name ?? null,
        reportDate: r.report_date,
        payload: r.payload,
        leadCalls: leadCallsByUser.get(r.user_id) ?? [],
      } satisfies DailyReportPdfData;
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function fetchUserReportPdfDataRange(input: {
  userId: string;
  fullName: string;
  branchName: string | null;
  days?: number;
  today?: string;
}): Promise<DailyReportPdfData[]> {
  const days = input.days ?? 30;
  const [yy, mm, dd] = (input.today ?? chileTodayIsoDate()).split("-").map(Number);
  const base = Date.UTC(yy, mm - 1, dd);
  const dayMs = 86400000;
  const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const startDate = fmt(base - (days - 1) * dayMs);
  const endExclusive = fmt(base + dayMs);

  const { data, error } = await supabase
    .from("daily_sales_reports")
    .select("report_date, payload")
    .eq("user_id", input.userId)
    .gte("report_date", startDate)
    .lt("report_date", endExclusive)
    .not("submitted_at", "is", null)
    .order("report_date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    fullName: input.fullName,
    branchName: input.branchName,
    reportDate: row.report_date,
    payload: normalizeDailySalesReportPayload(row.payload as DailySalesReportPayload),
  }));
}

export interface DailyReportMetricPoint {
  date: string;
  calls: number;
  credits: number;
  social: number;
  consignments: number;
}

export async function fetchUserReportMetrics(
  userId: string,
  days = 30,
  today?: string,
): Promise<DailyReportMetricPoint[]> {
  const [yy, mm, dd] = (today ?? chileTodayIsoDate()).split("-").map(Number);
  const base = Date.UTC(yy, mm - 1, dd);
  const dayMs = 86400000;
  const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const startDate = fmt(base - (days - 1) * dayMs);
  const endExclusive = fmt(base + dayMs);

  const { data, error } = await supabase
    .from("daily_sales_reports")
    .select("report_date, payload")
    .eq("user_id", userId)
    .gte("report_date", startDate)
    .lt("report_date", endExclusive)
    .not("submitted_at", "is", null)
    .order("report_date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const p = normalizeDailySalesReportPayload(row.payload as DailySalesReportPayload);
    return {
      date: row.report_date,
      calls: p.calls.filter((r) => consignmentRowHasData(r)).length,
      credits: p.credits.filter((r) => consignmentRowHasData(r)).length,
      social: p.social_posts.filter((r) => consignmentRowHasData(r)).length,
      consignments: p.effective_consignments.filter((r) => consignmentRowHasData(r)).length,
    } satisfies DailyReportMetricPoint;
  });
}

/**
 * Llamadas a leads de varios vendedores en un día (hora Chile), derivadas del CRM.
 * Read-only: cada nota de canal "llamada" registrada en el CRM es una fila.
 * Consulta una ventana UTC amplia (±1 día) y filtra el día exacto con `chileDayKey`,
 * igual que la regla "una raya por día" del CRM, para evitar bugs de DST.
 * Devuelve un Map userId → llamadas (incluye solo usuarios con llamadas).
 */
export async function fetchLeadsCallsForUsersDay(input: {
  userIds: string[];
  reportDate: string;
}): Promise<Map<string, LeadDailyCallRow[]>> {
  const grouped = new Map<string, LeadDailyCallRow[]>();
  if (input.userIds.length === 0) return grouped;

  const [yy, mm, dd] = input.reportDate.split("-").map(Number);
  const base = Date.UTC(yy, mm - 1, dd);
  const dayMs = 86400000;
  const fromIso = new Date(base - dayMs).toISOString();
  const toIso = new Date(base + 2 * dayMs).toISOString();

  const { data, error } = await supabase
    .from("lead_notes")
    .select(
      "id, lead_id, created_by, body, created_at, lead:leads(full_name, phone, vehicle_interest, status)",
    )
    .in("created_by", input.userIds)
    .eq("channel", "llamada")
    .eq("source", "vendor")
    .gte("created_at", fromIso)
    .lt("created_at", toIso)
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const row of data ?? []) {
    if (chileDayKey(row.created_at) !== input.reportDate) continue;
    if (!row.created_by) continue;
    const lead = row.lead as {
      full_name?: string | null;
      phone?: string | null;
      vehicle_interest?: string | null;
      status?: string | null;
    } | null;
    const call: LeadDailyCallRow = {
      note_id: row.id,
      lead_id: row.lead_id,
      customer_name: lead?.full_name ?? "—",
      phone: lead?.phone ?? "",
      vehicle_interest: lead?.vehicle_interest ?? "",
      lead_status: lead?.status ?? "",
      created_at: row.created_at,
      note: row.body ?? "",
    };
    const list = grouped.get(row.created_by);
    if (list) list.push(call);
    else grouped.set(row.created_by, [call]);
  }

  return grouped;
}

/** Llamadas a leads de un vendedor en un día (hora Chile), derivadas del CRM. */
export async function fetchLeadsCallsForUserDay(input: {
  userId: string;
  reportDate: string;
}): Promise<LeadDailyCallRow[]> {
  const grouped = await fetchLeadsCallsForUsersDay({
    userIds: [input.userId],
    reportDate: input.reportDate,
  });
  return grouped.get(input.userId) ?? [];
}

export async function buildDailyReportSupervisionRows(input: {
  tenantId: string;
  reportDate: string;
  branchId?: string | null;
  scope?: "branch" | "tenant";
}): Promise<DailyReportSupervisionRow[]> {
  let sellersQuery = supabase
    .from("users")
    .select("id, full_name, email, branch_id, branch:branches(name)")
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true)
    .in("role", [...SELLER_ROLES_FOR_DAILY_REPORT])
    .order("full_name", { ascending: true });

  if (input.scope !== "tenant" && input.branchId) {
    sellersQuery = sellersQuery.eq("branch_id", input.branchId);
  }

  const [{ data: sellers, error: sellersError }, reports] = await Promise.all([
    sellersQuery,
    fetchDailySalesReportsForDate(input.tenantId, input.reportDate, input.branchId ?? undefined),
  ]);

  if (sellersError) throw sellersError;

  const reportByUser = new Map(reports.map((r) => [r.user_id, r]));

  return (sellers ?? []).map((seller) => {
    const report = reportByUser.get(seller.id);
    const branchJoin = seller.branch as { name?: string } | null | undefined;
    return {
      user_id: seller.id,
      full_name: seller.full_name ?? seller.email ?? "Sin nombre",
      email: seller.email,
      branch_id: seller.branch_id,
      branch_name: branchJoin?.name ?? null,
      report_id: report?.id ?? null,
      submitted_at: report?.submitted_at ?? null,
      status: report?.submitted_at ? "submitted" : "pending",
    } satisfies DailyReportSupervisionRow;
  });
}
