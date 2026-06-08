export type SellerEngagementRow = {
  seller_key: string;
  user_id: string | null;
  staff_id: string | null;
  seller_name: string;
  notes_count: number;
  activities_count: number;
  lead_moves_count: number;
  last_seen_at: string | null;
  last_engagement_at: string | null;
  engagement_score: number;
  is_inactive: boolean;
  stale_assigned_leads: number;
};

export function formatEngagementBreakdown(row: Pick<
  SellerEngagementRow,
  "notes_count" | "activities_count" | "lead_moves_count"
>) {
  return `${row.notes_count} notas · ${row.activities_count} actividades · ${row.lead_moves_count} movimientos`;
}

export function engagementScoreLabel(score: number) {
  if (score >= 80) return "Excelente";
  if (score >= 55) return "Bueno";
  if (score >= 30) return "Regular";
  return "Bajo";
}

const DEFAULT_ENGAGEMENT_SLICE = {
  engagement_score: 0,
  notes_count: 0,
  activities_count: 0,
  lead_moves_count: 0,
  is_inactive: false,
  stale_assigned_leads: 0,
} as const;

export type EngagementBarSlice = typeof DEFAULT_ENGAGEMENT_SLICE;

function engagementSliceFromRow(
  row: Pick<
    SellerEngagementRow,
    | "engagement_score"
    | "notes_count"
    | "activities_count"
    | "lead_moves_count"
    | "is_inactive"
    | "stale_assigned_leads"
  >,
): EngagementBarSlice {
  return {
    engagement_score: row.engagement_score,
    notes_count: row.notes_count,
    activities_count: row.activities_count,
    lead_moves_count: row.lead_moves_count,
    is_inactive: row.is_inactive,
    stale_assigned_leads: row.stale_assigned_leads,
  };
}

export function normalizeSellerName(name: string) {
  return name.trim().toLowerCase();
}

/** Plantilla staff usa métricas CRM del usuario vinculado (staff_id o nombre). */
export function resolveEngagementForSeller(
  rows: SellerEngagementRow[],
  staffId: string,
  sellerName: string,
  linkedUserId?: string | null,
): EngagementBarSlice {
  const byStaff = rows.find((r) => r.staff_id === staffId);
  if (byStaff) return engagementSliceFromRow(byStaff);

  if (linkedUserId) {
    const byUserId = rows.find((r) => r.user_id === linkedUserId);
    if (byUserId) return engagementSliceFromRow(byUserId);
  }

  const key = normalizeSellerName(sellerName);
  const byName = rows.find(
    (r) => r.user_id != null && normalizeSellerName(r.seller_name) === key,
  );
  if (byName) return engagementSliceFromRow(byName);

  return { ...DEFAULT_ENGAGEMENT_SLICE };
}

export function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60)));
}
