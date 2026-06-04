import { useAuth } from "@/contexts/AuthContext";
import type { SellerEngagementRow } from "@/lib/sellerEngagement";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

function mapRow(raw: Record<string, unknown>): SellerEngagementRow {
  return {
    seller_key: String(raw.seller_key ?? ""),
    user_id: (raw.user_id as string | null) ?? null,
    staff_id: (raw.staff_id as string | null) ?? null,
    seller_name: String(raw.seller_name ?? "Sin nombre"),
    notes_count: Number(raw.notes_count ?? 0),
    activities_count: Number(raw.activities_count ?? 0),
    lead_moves_count: Number(raw.lead_moves_count ?? 0),
    last_seen_at: (raw.last_seen_at as string | null) ?? null,
    last_engagement_at: (raw.last_engagement_at as string | null) ?? null,
    engagement_score: Number(raw.engagement_score ?? 0),
    is_inactive: Boolean(raw.is_inactive),
    stale_assigned_leads: Number(raw.stale_assigned_leads ?? 0),
  };
}

export function useSellerEngagement(options?: {
  branchId?: string | null;
  windowDays?: number;
  inactivityHours?: number | null;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const branchId = options?.branchId ?? user?.branch_id ?? null;
  const windowDays = options?.windowDays ?? 7;
  const inactivityHours = options?.inactivityHours ?? null;

  return useQuery({
    queryKey: [
      "seller-engagement",
      user?.tenant_id,
      branchId ?? "all",
      windowDays,
      inactivityHours ?? "tenant-default",
    ],
    enabled: (options?.enabled ?? true) && !!user?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_engagement_metrics" as never, {
        p_branch_id: branchId,
        p_window_days: windowDays,
        p_inactivity_hours: inactivityHours,
      } as never);
      if (error) throw error;
      return ((data ?? []) as unknown[]).map((r) => mapRow(r as Record<string, unknown>));
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}

export function findEngagementForUser(rows: SellerEngagementRow[], userId: string) {
  return rows.find((r) => r.user_id === userId) ?? null;
}

export function findEngagementForStaff(rows: SellerEngagementRow[], staffId: string) {
  return rows.find((r) => r.staff_id === staffId) ?? null;
}
