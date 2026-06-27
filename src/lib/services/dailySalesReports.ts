import { supabase } from "@/lib/supabase";
import type {
  DailyReportSupervisionRow,
  DailySalesReport,
  DailySalesReportPayload,
} from "@/lib/types/dailySalesReport";
import {
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
