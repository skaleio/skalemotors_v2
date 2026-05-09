import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { resolveRange, type RankingPeriodKey, type RankingRange } from './useSalesRanking'

// ============================================================================
// Ranking de consignaciones por vendedor (creador) — hook TanStack Query.
// Llama a public.get_consignaciones_ranking (SECURITY DEFINER, RBAC server-side)
// y devuelve agregados. Calcula delta vs período previo en paralelo.
// El range helper se reutiliza desde useSalesRanking para no duplicar lógica.
// ============================================================================

export type ConsignacionesRankingPeriodKey = RankingPeriodKey

export interface ConsignacionesRankingRow {
  seller_key: string
  seller_id: string | null
  seller_name: string
  branch_id: string | null
  branch_name: string | null
  consignaciones_count: number
  publicadas_count: number
  vendidas_count: number
}

export interface ConsignacionesRankingEntry extends ConsignacionesRankingRow {
  position: number
  prev_consignaciones_count: number
  delta_count: number
}

export { resolveRange }
export type { RankingRange }

// Exportado para tests unitarios — convierte la fila cruda del RPC en el shape
// tipado que usa la UI, con defaults seguros frente a NULL/missing.
export function parseRankingRow(raw: unknown): ConsignacionesRankingRow {
  const row = (raw ?? {}) as Record<string, unknown>
  return {
    seller_key: String(row.seller_key ?? ''),
    seller_id: (row.seller_id as string | null) ?? null,
    seller_name: String(row.seller_name ?? 'Sin nombre'),
    branch_id: (row.branch_id as string | null) ?? null,
    branch_name: (row.branch_name as string | null) ?? null,
    consignaciones_count: Number(row.consignaciones_count ?? 0),
    publicadas_count: Number(row.publicadas_count ?? 0),
    vendidas_count: Number(row.vendidas_count ?? 0),
  }
}

// Calcula posición + delta vs período previo. Pura — testeable sin DB.
export function buildRankingEntries(
  current: ConsignacionesRankingRow[],
  previous: ConsignacionesRankingRow[],
): ConsignacionesRankingEntry[] {
  const prevByKey = new Map(
    previous.map((r) => [r.seller_key, r.consignaciones_count] as const),
  )
  return current.map((r, idx) => {
    const prev = prevByKey.get(r.seller_key) ?? 0
    return {
      ...r,
      position: idx + 1,
      prev_consignaciones_count: prev,
      delta_count: r.consignaciones_count - prev,
    }
  })
}

async function callRpc(
  fromStr: string,
  toStr: string,
  branchId?: string | null,
): Promise<ConsignacionesRankingRow[]> {
  const { data, error } = await supabase.rpc('get_consignaciones_ranking' as never, {
    p_from: fromStr,
    p_to: toStr,
    p_branch_id: branchId ?? null,
  } as never)
  if (error) throw error
  return ((data ?? []) as unknown[]).map(parseRankingRow)
}

export function useConsignacionesRanking(
  period: ConsignacionesRankingPeriodKey,
  branchId: string | null | undefined,
  options?: { enabled?: boolean; anchor?: Date },
) {
  const range = resolveRange(period, options?.anchor)
  return useQuery({
    queryKey: ['consignaciones-ranking', period, branchId ?? 'all', range.fromStr, range.toStr],
    queryFn: async (): Promise<{ range: RankingRange; rows: ConsignacionesRankingEntry[] }> => {
      const [current, previous] = await Promise.all([
        callRpc(range.fromStr, range.toStr, branchId),
        callRpc(range.prevFromStr, range.prevToStr, branchId),
      ])
      return { range, rows: buildRankingEntries(current, previous) }
    },
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
