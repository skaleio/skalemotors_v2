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

export function emptyCallRow(): DailyReportCallRow {
  return { customer_name: "", phone: "", vehicle: "", year: "", reason: "", result: "" };
}

export function emptyCreditRow(): DailyReportCreditRow {
  return { customer_name: "", rut: "", institution: "", status: "" };
}

export function emptyPlatformRow(): DailyReportPlatformRow {
  return { vehicle: "", year: "", platform: "", observation: "" };
}

export function emptyDailySalesReportPayload(): DailySalesReportPayload {
  return {
    calls: [emptyCallRow(), emptyCallRow()],
    credits: [emptyCreditRow()],
    social_media: {
      total_posts: null,
      vehicles_posted: [""],
    },
    platform_uploads: [emptyPlatformRow()],
    daily_observations: "",
  };
}

function rowHasData(values: Record<string, string | number | null | undefined>): boolean {
  return Object.values(values).some((v) => String(v ?? "").trim() !== "");
}

export function countDailyReportProgress(payload: DailySalesReportPayload) {
  const calls = payload.calls.filter((r) => rowHasData(r)).length;
  const credits = payload.credits.filter((r) => rowHasData(r)).length;
  const social =
    payload.social_media.total_posts != null ||
    payload.social_media.vehicles_posted.some((v) => v.trim());
  const platforms = payload.platform_uploads.filter((r) => rowHasData(r)).length;
  const observations = payload.daily_observations.trim().length > 0;
  const sections = [
    calls > 0,
    credits > 0,
    social,
    platforms > 0,
    observations,
  ];
  return {
    calls,
    credits,
    platforms,
    sectionsFilled: sections.filter(Boolean).length,
    sectionsTotal: sections.length,
  };
}

export function normalizeDailySalesReportPayload(
  raw: Partial<DailySalesReportPayload> | null | undefined,
): DailySalesReportPayload {
  const base = emptyDailySalesReportPayload();
  if (!raw) return base;

  const calls = Array.isArray(raw.calls) ? raw.calls.map((r) => ({ ...emptyCallRow(), ...r })) : base.calls;
  const credits = Array.isArray(raw.credits)
    ? raw.credits.map((r) => ({ ...emptyCreditRow(), ...r }))
    : base.credits;
  const platforms = Array.isArray(raw.platform_uploads)
    ? raw.platform_uploads.map((r) => ({ ...emptyPlatformRow(), ...r }))
    : base.platform_uploads;
  const vehiclesPosted = raw.social_media?.vehicles_posted ?? base.social_media.vehicles_posted;

  const ensureTrailingEmpty = <T extends Record<string, string>>(
    rows: T[],
    empty: () => T,
  ): T[] => {
    if (rows.length === 0) return [empty()];
    const last = rows[rows.length - 1];
    return rowHasData(last) ? [...rows, empty()] : rows;
  };

  return {
    calls: ensureTrailingEmpty(calls, emptyCallRow),
    credits: ensureTrailingEmpty(credits, emptyCreditRow),
    social_media: {
      total_posts:
        typeof raw.social_media?.total_posts === "number"
          ? raw.social_media.total_posts
          : raw.social_media?.total_posts === null
            ? null
            : base.social_media.total_posts,
      vehicles_posted:
        vehiclesPosted.length > 0
          ? ensureTrailingEmpty(
              vehiclesPosted.map((v) => ({ v })),
              () => ({ v: "" }),
            ).map((x) => x.v)
          : [""],
    },
    platform_uploads: ensureTrailingEmpty(platforms, emptyPlatformRow),
    daily_observations: raw.daily_observations ?? "",
  };
}

export function chileTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
  }).format(new Date());
}
