import { findEngagementForUser } from "@/hooks/useSellerEngagement";
import type { SellerEngagementRow } from "@/lib/sellerEngagement";

const CONSIGNACION_TAG_PREFIX = "consignacion:";

type LeadLike = {
  assigned_to: string | null;
  tags: unknown;
};

export type CrmVendorPerformanceRow = {
  vendorId: string;
  name: string;
  leadCount: number;
  /** Movimientos en CRM (cambios de estado / leads actualizados, últimos 7 días). */
  leadMovesCount: number;
  notesCount: number;
  activitiesCount: number;
  engagementScore: number;
  isInactive: boolean;
};

export type CrmVendorTeamPerformance = {
  vendors: CrmVendorPerformanceRow[];
  activeVendorCount: number;
  totalLeads: number;
  teamMoveCount: number;
  teamEngagementAvg: number;
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

function isConsignacionLead(lead: LeadLike): boolean {
  return normalizeTags(lead.tags).some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
}

function countLeadsForVendor(leads: LeadLike[], vendorId: string) {
  return leads.filter((lead) => lead.assigned_to === vendorId && !isConsignacionLead(lead)).length;
}

export function buildCrmVendorTeamPerformance(input: {
  leads: LeadLike[];
  vendors: Array<{ id: string; full_name?: string | null; email?: string | null }>;
  engagementRows: SellerEngagementRow[];
}): CrmVendorTeamPerformance {
  const { leads, vendors, engagementRows } = input;
  const rows: CrmVendorPerformanceRow[] = [];

  for (const vendor of vendors) {
    const leadCount = countLeadsForVendor(leads, vendor.id);
    if (leadCount === 0) continue;

    const engagement = findEngagementForUser(engagementRows, vendor.id);
    const name = vendor.full_name?.trim() || vendor.email?.trim() || "Vendedor";

    rows.push({
      vendorId: vendor.id,
      name,
      leadCount,
      leadMovesCount: engagement?.lead_moves_count ?? 0,
      notesCount: engagement?.notes_count ?? 0,
      activitiesCount: engagement?.activities_count ?? 0,
      engagementScore: engagement?.engagement_score ?? 0,
      isInactive: engagement?.is_inactive ?? false,
    });
  }

  rows.sort(
    (a, b) =>
      b.leadMovesCount - a.leadMovesCount
      || b.engagementScore - a.engagementScore,
  );

  const activeVendorCount = rows.length;
  const totalLeads = rows.reduce((sum, r) => sum + r.leadCount, 0);
  const teamMoveCount = rows.reduce((sum, r) => sum + r.leadMovesCount, 0);
  const teamEngagementAvg =
    activeVendorCount > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.engagementScore, 0) / activeVendorCount)
      : 0;

  return {
    vendors: rows,
    activeVendorCount,
    totalLeads,
    teamMoveCount,
    teamEngagementAvg,
  };
}
