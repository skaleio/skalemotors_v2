export interface DailyReportCallRow {
  customer_name: string;
  phone: string;
  vehicle: string;
  year: string;
  reason: string;
  result: string;
}

export interface DailyReportCreditRow {
  customer_name: string;
  rut: string;
  institution: string;
  status: string;
}

export interface DailyReportPlatformRow {
  vehicle: string;
  year: string;
  platform: string;
  observation: string;
}

export interface DailySalesReportPayload {
  calls: DailyReportCallRow[];
  credits: DailyReportCreditRow[];
  social_media: {
    total_posts: number | null;
    vehicles_posted: string[];
  };
  platform_uploads: DailyReportPlatformRow[];
  daily_observations: string;
}

export interface DailySalesReport {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  user_id: string;
  report_date: string;
  payload: DailySalesReportPayload;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReportSupervisionRow {
  user_id: string;
  full_name: string;
  email: string | null;
  branch_id: string | null;
  branch_name: string | null;
  report_id: string | null;
  submitted_at: string | null;
  status: "submitted" | "pending";
}

export const DAILY_REPORT_ALERT_REASON = "daily_sales_report";

export const SELLER_ROLES_FOR_DAILY_REPORT = ["vendedor", "jefe_sucursal"] as const;

export const SUPERVISOR_ROLES_FOR_DAILY_REPORT = [
  "admin",
  "jefe_jefe",
  "gerente",
  "jefe_sucursal",
] as const;

export function emptyDailySalesReportPayload(): DailySalesReportPayload {
  return {
    calls: Array.from({ length: 6 }, () => ({
      customer_name: "",
      phone: "",
      vehicle: "",
      year: "",
      reason: "",
      result: "",
    })),
    credits: Array.from({ length: 7 }, () => ({
      customer_name: "",
      rut: "",
      institution: "",
      status: "",
    })),
    social_media: {
      total_posts: null,
      vehicles_posted: ["", "", "", "", ""],
    },
    platform_uploads: Array.from({ length: 5 }, () => ({
      vehicle: "",
      year: "",
      platform: "",
      observation: "",
    })),
    daily_observations: "",
  };
}

export function normalizeDailySalesReportPayload(
  raw: Partial<DailySalesReportPayload> | null | undefined,
): DailySalesReportPayload {
  const base = emptyDailySalesReportPayload();
  if (!raw) return base;

  const calls = Array.isArray(raw.calls) ? raw.calls : [];
  const credits = Array.isArray(raw.credits) ? raw.credits : [];
  const platforms = Array.isArray(raw.platform_uploads) ? raw.platform_uploads : [];
  const vehiclesPosted = raw.social_media?.vehicles_posted ?? [];

  return {
    calls: base.calls.map((row, i) => ({ ...row, ...(calls[i] ?? {}) })),
    credits: base.credits.map((row, i) => ({ ...row, ...(credits[i] ?? {}) })),
    social_media: {
      total_posts:
        typeof raw.social_media?.total_posts === "number"
          ? raw.social_media.total_posts
          : raw.social_media?.total_posts === null
            ? null
            : base.social_media.total_posts,
      vehicles_posted: base.social_media.vehicles_posted.map(
        (v, i) => vehiclesPosted[i] ?? v,
      ),
    },
    platform_uploads: base.platform_uploads.map((row, i) => ({
      ...row,
      ...(platforms[i] ?? {}),
    })),
    daily_observations: raw.daily_observations ?? "",
  };
}

export function chileTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
  }).format(new Date());
}
