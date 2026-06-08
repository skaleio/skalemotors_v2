import { findEngagementForUser } from "@/hooks/useSellerEngagement";
import type { SellerEngagementRow } from "@/lib/sellerEngagement";
import {
  computeVendorCrmActivityScore,
  type CrmLeadActivityInput,
  type CrmVendorActivityScore,
} from "@/lib/crmVendorActivityScore";

export type CrmVendorPerformanceRow = {
  vendorId: string;
  name: string;
  activity: CrmVendorActivityScore;
};

export type CrmVendorTeamPerformance = {
  vendors: CrmVendorPerformanceRow[];
  activeVendorCount: number;
  totalLeads: number;
  teamPipelineMoves: number;
  teamActivityAvg: number;
  teamStaleLeads: number;
};

export function buildCrmVendorTeamPerformance(input: {
  leads: CrmLeadActivityInput[];
  vendors: Array<{ id: string; full_name?: string | null; email?: string | null }>;
  engagementRows: SellerEngagementRow[];
}): CrmVendorTeamPerformance {
  const { leads, vendors, engagementRows } = input;
  const rows: CrmVendorPerformanceRow[] = [];

  for (const vendor of vendors) {
    const engagement = findEngagementForUser(engagementRows, vendor.id);
    const activity = computeVendorCrmActivityScore({
      vendorId: vendor.id,
      leads,
      engagement,
    });

    if (activity.totalLeads === 0) continue;

    const name = vendor.full_name?.trim() || vendor.email?.trim() || "Vendedor";
    rows.push({ vendorId: vendor.id, name, activity });
  }

  rows.sort(
    (a, b) =>
      b.activity.activityScore - a.activity.activityScore
      || b.activity.pipelineMoves - a.activity.pipelineMoves,
  );

  const activeVendorCount = rows.length;
  const totalLeads = rows.reduce((sum, r) => sum + r.activity.totalLeads, 0);
  const teamPipelineMoves = rows.reduce((sum, r) => sum + r.activity.pipelineMoves, 0);
  const teamStaleLeads = rows.reduce((sum, r) => sum + r.activity.staleOpenLeads, 0);
  const teamActivityAvg =
    activeVendorCount > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + r.activity.activityScore, 0) / activeVendorCount,
        )
      : 0;

  return {
    vendors: rows,
    activeVendorCount,
    totalLeads,
    teamPipelineMoves,
    teamActivityAvg,
    teamStaleLeads,
  };
}
