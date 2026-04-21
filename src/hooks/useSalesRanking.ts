import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

// ============================================================================
// Ranking de vendedores — hook TanStack Query.
// Llama a la RPC public.get_sales_ranking que aplica RBAC server-side y
// devuelve solo agregados (sin PII de clientes/leads).
// Pide período actual y previo en paralelo para calcular variación.
// ============================================================================

export type RankingPeriodKey = 'week' | 'month' | 'quarter'

export interface RankingRow {
  seller_key: string
  seller_id: string | null
  seller_name: string
  branch_id: string | null
  branch_name: string | null
  sales_count: number
  total_amount: number
  total_margin: number
  is_linked_user: boolean
}

export interface RankingEntry extends RankingRow {
  position: number
  prev_sales_count: number
  delta_count: number
}

export interface RankingRange {
  fromStr: string
  toStr: string
  prevFromStr: string
  prevToStr: string
  label: string
}

function pad2(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }

function startOfISOWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (out.getDay() + 6) % 7 // 0=lunes
  out.setDate(out.getDate() - dow)
  return out
}

export function resolveRange(period: RankingPeriodKey, anchor: Date = new Date()): RankingRange {
  if (period === 'week') {
    const start = startOfISOWeek(anchor)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - 6)
    return {
      fromStr: toDateStr(start), toStr: toDateStr(end),
      prevFromStr: toDateStr(prevStart), prevToStr: toDateStr(prevEnd),
      label: `Semana del ${toDateStr(start)}`,
    }
  }
  if (period === 'quarter') {
    const q = Math.floor(anchor.getMonth() / 3)
    const start = new Date(anchor.getFullYear(), q * 3, 1)
    const end = new Date(anchor.getFullYear(), q * 3 + 3, 0)
    const prevStart = new Date(start); prevStart.setMonth(prevStart.getMonth() - 3)
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
    return {
      fromStr: toDateStr(start), toStr: toDateStr(end),
      prevFromStr: toDateStr(prevStart), prevToStr: toDateStr(prevEnd),
      label: `Q${q + 1} ${anchor.getFullYear()}`,
    }
  }
  // month (default): mes calendario del anchor
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const prevStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)
  const prevEnd = new Date(anchor.getFullYear(), anchor.getMonth(), 0)
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return {
    fromStr: toDateStr(start), toStr: toDateStr(end),
    prevFromStr: toDateStr(prevStart), prevToStr: toDateStr(prevEnd),
    label: `${MESES[start.getMonth()]} ${start.getFullYear()}`,
  }
}

async function callRpc(fromStr: string, toStr: string, branchId?: string | null): Promise<RankingRow[]> {
  const { data, error } = await supabase.rpc('get_sales_ranking' as never, {
    p_from: fromStr,
    p_to: toStr,
    p_branch_id: branchId ?? null,
  } as never)
  if (error) throw error
  return ((data ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>
    return {
      seller_key: String(row.seller_key ?? ''),
      seller_id: (row.seller_id as string | null) ?? null,
      seller_name: String(row.seller_name ?? 'Sin nombre'),
      branch_id: (row.branch_id as string | null) ?? null,
      branch_name: (row.branch_name as string | null) ?? null,
      sales_count: Number(row.sales_count ?? 0),
      total_amount: Number(row.total_amount ?? 0),
      total_margin: Number(row.total_margin ?? 0),
      is_linked_user: Boolean(row.is_linked_user),
    }
  })
}

export function useSalesRanking(
  period: RankingPeriodKey,
  branchId: string | null | undefined,
  options?: { enabled?: boolean; anchor?: Date },
) {
  const range = resolveRange(period, options?.anchor)
  return useQuery({
    queryKey: ['sales-ranking', period, branchId ?? 'all', range.fromStr, range.toStr],
    queryFn: async (): Promise<{ range: RankingRange; rows: RankingEntry[] }> => {
      const [current, previous] = await Promise.all([
        callRpc(range.fromStr, range.toStr, branchId),
        callRpc(range.prevFromStr, range.prevToStr, branchId),
      ])
      const prevByKey = new Map(previous.map((r) => [r.seller_key, r.sales_count]))
      const rows: RankingEntry[] = current.map((r, idx) => {
        const prev = prevByKey.get(r.seller_key) ?? 0
        return { ...r, position: idx + 1, prev_sales_count: prev, delta_count: r.sales_count - prev }
      })
      return { range, rows }
    },
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
