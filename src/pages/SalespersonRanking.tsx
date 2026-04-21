// ============================================================================
// Ranking de vendedores — UI.
// Spec MVP:
//  - Fuente de verdad: public.sales (status=completada, payment_status=realizado)
//  - Atribución unificada: seller_id (user) + fallback seller_name+branch (plantilla)
//  - Períodos: mes (default), semana, trimestre
//  - RBAC aplicado en el RPC (SECURITY DEFINER) — la UI solo muestra lo que llega.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, TrendingUp, TrendingDown, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useSalesRanking, type RankingPeriodKey, type RankingEntry } from '@/hooks/useSalesRanking'

const NO_BRANCH_FILTER = '__all__'

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

function PodiumCard({ entry, place }: { entry: RankingEntry; place: 1 | 2 | 3 }) {
  const Icon = place === 1 ? Trophy : place === 2 ? Medal : Award
  const color = place === 1 ? 'text-yellow-500' : place === 2 ? 'text-slate-400' : 'text-amber-700'
  const ring = place === 1 ? 'ring-yellow-500' : place === 2 ? 'ring-slate-400' : 'ring-amber-700'
  return (
    <Card className={`ring-2 ${ring}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Icon className={`h-6 w-6 ${color}`} aria-hidden />
          <span className="text-2xl font-bold text-muted-foreground">#{place}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-semibold truncate" title={entry.seller_name}>{entry.seller_name}</div>
        {entry.branch_name && (
          <div className="text-xs text-muted-foreground truncate">{entry.branch_name}</div>
        )}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{entry.sales_count}</span>
          <span className="text-xs text-muted-foreground">ventas</span>
        </div>
        <div className="text-sm text-muted-foreground">{formatCLP(entry.total_amount)}</div>
      </CardContent>
    </Card>
  )
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <TrendingUp className="h-3 w-3" aria-hidden /> +{delta}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
      <TrendingDown className="h-3 w-3" aria-hidden /> {delta}
    </span>
  )
}

export default function SalespersonRanking() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<RankingPeriodKey>('month')
  const [branchId, setBranchId] = useState<string>(NO_BRANCH_FILTER)
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [anchor, setAnchor] = useState<Date>(() => new Date())

  const now = new Date()
  const isCurrentPeriod = useMemo(() => {
    if (period === 'month') {
      return anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth()
    }
    if (period === 'quarter') {
      return anchor.getFullYear() === now.getFullYear() && Math.floor(anchor.getMonth() / 3) === Math.floor(now.getMonth() / 3)
    }
    return Math.abs(anchor.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000
  }, [period, anchor, now])

  const stepAnchor = (direction: -1 | 1) => {
    const d = new Date(anchor)
    if (period === 'week') d.setDate(d.getDate() + direction * 7)
    else if (period === 'quarter') d.setMonth(d.getMonth() + direction * 3)
    else d.setMonth(d.getMonth() + direction)
    if (direction > 0 && d > now) return
    setAnchor(d)
  }

  const goCurrent = () => setAnchor(new Date())

  const canFilterBranch = useMemo(() => {
    if (!user) return false
    return ['admin', 'gerente', 'financiero', 'jefe_jefe'].includes(user.role)
  }, [user])

  const restrictedRole = user?.role === 'servicio' || user?.role === 'inventario'

  useEffect(() => {
    if (!canFilterBranch) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (!cancelled && data) setBranches(data as Array<{ id: string; name: string }>)
    })()
    return () => { cancelled = true }
  }, [canFilterBranch])

  const effectiveBranchId = branchId === NO_BRANCH_FILTER ? null : branchId

  const { data, isLoading, error } = useSalesRanking(period, effectiveBranchId, {
    enabled: !!user && !restrictedRole,
    anchor,
  })

  const rows = data?.rows ?? []
  const rangeLabel = data?.range.label ?? ''

  if (restrictedRole) {
    return (
      <div className="max-w-3xl mx-auto mt-16 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Sin acceso al ranking</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu rol no tiene permiso para ver métricas de ventas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ranking de Vendedores</h1>
          <p className="text-sm text-muted-foreground">
            Cada mes se reinicia automáticamente · Navegá con las flechas para revisar históricos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={period} onValueChange={(v) => { setPeriod(v as RankingPeriodKey); setAnchor(new Date()) }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 rounded-md border border-border">
            <Button variant="ghost" size="icon" onClick={() => stepAnchor(-1)} aria-label="Período anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium">{rangeLabel || '—'}</span>
            <Button variant="ghost" size="icon" onClick={() => stepAnchor(1)} disabled={isCurrentPeriod} aria-label="Período siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!isCurrentPeriod && (
            <Button variant="outline" size="sm" onClick={goCurrent}>Hoy</Button>
          )}
          {canFilterBranch && (
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BRANCH_FILTER}>Todas las sucursales</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6 text-sm text-rose-600">
            <AlertCircle className="h-5 w-5" aria-hidden />
            <span>No se pudo cargar el ranking: {(error as Error).message}</span>
          </CardContent>
        </Card>
      )}

      {rows.length >= 3 && rows[0].sales_count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PodiumCard entry={rows[0]} place={1} />
          <PodiumCard entry={rows[1]} place={2} />
          <PodiumCard entry={rows[2]} place={3} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tabla completa</CardTitle>
          <CardDescription>
            Ordenado por cantidad de ventas (desempate: monto).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No hay vendedores activos en esta vista.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Δ vs anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isMe = user?.role === 'vendedor' && r.seller_id === user.id
                  return (
                    <TableRow key={r.seller_key} className={isMe ? 'bg-primary/5' : undefined}>
                      <TableCell className="font-semibold">{r.position}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.seller_name}</span>
                          {!r.is_linked_user && (
                            <Badge variant="secondary" className="text-[10px]">plantilla</Badge>
                          )}
                          {isMe && <Badge className="text-[10px]">tú</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.branch_name ?? '—'}</TableCell>
                      <TableCell className="text-right font-semibold">{r.sales_count}</TableCell>
                      <TableCell className="text-right">{formatCLP(r.total_amount)}</TableCell>
                      <TableCell className="text-right">{formatCLP(r.total_margin)}</TableCell>
                      <TableCell className="text-right"><DeltaBadge delta={r.delta_count} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
