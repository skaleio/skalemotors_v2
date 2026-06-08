import { scheduleWhenIdle } from "@/lib/scheduleIdle";
import { isSalesDashboardRole, PHOTOGRAPHER_ROLE } from "@/lib/appRoles";

/** Precarga el chunk de la ruta post-login más probable según rol (idle, no bloquea auth). */
export function schedulePostAuthChunkPrefetch(role: string | undefined | null): () => void {
  return scheduleWhenIdle(
    () => {
      if (isSalesDashboardRole(role)) {
        void import("@/pages/SalesDashboard").catch(() => {});
        return;
      }
      if (role === PHOTOGRAPHER_ROLE) {
        void import("@/pages/Consignaciones").catch(() => {});
      }
    },
    { idleTimeoutMs: 2000, fallbackDelayMs: 400 },
  );
}
