import { useQuery } from "@tanstack/react-query";
import { getAiCostSummary } from "@/lib/services/aiCostMonitor";

const SUPER_ADMIN_EMAIL = "hessen@test.io";

export function isSuperAdminMonitorUser(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;
}

/**
 * Trae el agregado de costos AI desde la RPC. Sólo dispara la query si el usuario
 * actual es el super-admin (hessen@test.io); para cualquier otro user, la query
 * queda deshabilitada y no consume cuota.
 */
export function useAiCostMonitor(
  from: string,
  to: string,
  currentUserEmail: string | null | undefined,
) {
  const enabled = isSuperAdminMonitorUser(currentUserEmail);
  return useQuery({
    queryKey: ["ai-cost-monitor", from, to, currentUserEmail ?? "guest"],
    queryFn: () => getAiCostSummary(from, to),
    enabled,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
