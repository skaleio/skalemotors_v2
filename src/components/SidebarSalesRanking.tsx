// Mini ranking en sidebar (solo vendedor). Usa el mismo RPC/hook que la página
// completa; queda compacto para generar presión sana de competencia.

import { Trophy } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSalesRanking } from '@/hooks/useSalesRanking'

const TOP_N = 5

interface Props { collapsed: boolean }

export function SidebarSalesRanking({ collapsed }: Props) {
  const { user } = useAuth()
  const { data, isLoading } = useSalesRanking('month', null, { enabled: !!user })

  if (!user || user.role !== 'vendedor') return null
  if (collapsed) return null

  const rows = data?.rows ?? []
  const ownIndex = rows.findIndex((r) => r.seller_id === user.id)
  const ownRow = ownIndex >= 0 ? rows[ownIndex] : null

  // Visibles: top N. Si el usuario no está en el top, añadir su fila al final.
  const topRows = rows.slice(0, TOP_N)
  const showOwnExtra = ownRow && ownIndex >= TOP_N

  return (
    <div className="mx-2 mt-3 mb-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-zinc-200">
        <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden />
        <span>Ranking del mes</span>
      </div>

      {isLoading ? (
        <div className="mt-2 text-[11px] text-muted-foreground">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="mt-2 text-[11px] text-muted-foreground">Sin ventas este mes.</div>
      ) : (
        <ul className="mt-2 space-y-1">
          {topRows.map((r, idx) => {
            const isMe = r.seller_id === user.id
            return (
              <li
                key={r.seller_key}
                className={[
                  'flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px]',
                  isMe
                    ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-900 dark:text-pink-200 font-semibold'
                    : 'text-slate-700 dark:text-zinc-300',
                ].join(' ')}
                title={r.seller_name}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-4 shrink-0 text-right tabular-nums">{idx + 1}</span>
                  <span className="truncate">{isMe ? 'Tú' : r.seller_name}</span>
                </span>
                <span className="tabular-nums shrink-0">{r.sales_count}</span>
              </li>
            )
          })}
          {showOwnExtra && ownRow && (
            <>
              <li className="px-1.5 text-[10px] text-muted-foreground">…</li>
              <li
                className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px] bg-pink-50 dark:bg-pink-950/40 text-pink-900 dark:text-pink-200 font-semibold"
                title={ownRow.seller_name}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-4 shrink-0 text-right tabular-nums">{ownIndex + 1}</span>
                  <span className="truncate">Tú</span>
                </span>
                <span className="tabular-nums shrink-0">{ownRow.sales_count}</span>
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  )
}
