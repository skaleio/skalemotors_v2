import { leadService } from "@/lib/services/leads";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

const LEADS_PREFETCH_TTL_MS = 5 * 60 * 1000;
const LEADS_PREFETCH_KEY_PREFIX = "skale.prefetch.leads";

/**
 * Prefetch de leads en segundo plano cuando el usuario está en la app.
 * Así, al entrar a Leads la data suele estar en caché y la pantalla carga al instante.
 */
export function PrefetchLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const didPrefetch = useRef(false);

  useEffect(() => {
    const branchId = user?.branch_id;
    if (!branchId) {
      didPrefetch.current = false;
      return;
    }

    const prefetchKey = `${LEADS_PREFETCH_KEY_PREFIX}.${branchId}`;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const markPrefetched = () => {
      didPrefetch.current = true;
      try {
        window.localStorage.setItem(prefetchKey, String(Date.now()));
      } catch {
        // ignorar si localStorage no está disponible
      }
    };

    const hasFreshPrefetch = () => {
      try {
        const raw = window.localStorage.getItem(prefetchKey);
        if (!raw) return false;
        const timestamp = Number(raw);
        return Number.isFinite(timestamp) && Date.now() - timestamp < LEADS_PREFETCH_TTL_MS;
      } catch {
        return false;
      }
    };

    const runPrefetch = () => {
      if (didPrefetch.current || document.visibilityState !== "visible" || hasFreshPrefetch()) {
        return;
      }

      markPrefetched();
      void import("@/pages/Leads");
      void queryClient.prefetchQuery({
        queryKey: ["leads", branchId, undefined, undefined, undefined, undefined],
        queryFn: () => leadService.getAll({ branchId }),
        staleTime: LEADS_PREFETCH_TTL_MS,
      });
    };

    const schedulePrefetch = () => {
      if (didPrefetch.current || document.visibilityState !== "visible" || hasFreshPrefetch()) {
        if (hasFreshPrefetch()) {
          didPrefetch.current = true;
        }
        return;
      }

      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(runPrefetch, { timeout: 1500 });
        return;
      }

      timeoutId = window.setTimeout(runPrefetch, 1200);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        schedulePrefetch();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === prefetchKey && event.newValue) {
        didPrefetch.current = true;
      }
    };

    schedulePrefetch();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (idleId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [user?.branch_id, queryClient]);
}
