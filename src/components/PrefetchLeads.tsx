import { leadService } from "@/lib/services/leads";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";

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
    if (didPrefetch.current) return;

    const timer = window.setTimeout(() => {
      didPrefetch.current = true;
      queryClient.prefetchQuery({
        queryKey: ["leads", branchId, undefined, undefined, undefined, undefined],
        queryFn: () => leadService.getAll({ branchId }),
        staleTime: 5 * 60 * 1000,
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [user?.branch_id, queryClient]);
}
