import { PHOTOGRAPHER_ROLE, VENDOR_ROLE } from "@/lib/appRoles";
import { scheduleWhenIdle } from "@/lib/scheduleIdle";

/** Precarga el chunk de la ruta post-login más probable según rol (idle, no bloquea auth). */
export function schedulePostAuthChunkPrefetch(role: string | undefined | null): () => void {
  return scheduleWhenIdle(
    () => {
      if (role === VENDOR_ROLE) {
        void import("@/pages/CRM").catch(() => {});
        return;
      }
      if (role === PHOTOGRAPHER_ROLE) {
        void import("@/pages/Consignaciones").catch(() => {});
      }
    },
    { idleTimeoutMs: 2000, fallbackDelayMs: 400 },
  );
}
