import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ConsignacionesAdminRankingRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  count_total: number;
  count_publicadas: number;
  count_stale: number;
}

/**
 * Ranking agregado de consignaciones por creador.
 * RPC `consignaciones_admin_ranking()` con SECURITY INVOKER: la RLS aplica al
 * caller — admin ve su branch entero, vendedor solo lo suyo, jefe_jefe el tenant.
 *
 * Usado por la vista de /app/consignaciones cuando el rol es admin/jefe_jefe.
 * Distinto a `useConsignacionesRanking` (ese trabaja con períodos para Sales).
 */
export function useConsignacionesAdminRanking(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;

  return useQuery({
    queryKey: ["consignaciones-admin-ranking"],
    queryFn: async (): Promise<ConsignacionesAdminRankingRow[]> => {
      const { data, error } = await supabase.rpc("consignaciones_admin_ranking" as never);
      if (error) throw error;
      return (data ?? []) as ConsignacionesAdminRankingRow[];
    },
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
