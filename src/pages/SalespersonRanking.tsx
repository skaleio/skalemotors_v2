// ============================================================================
// Ranking de vendedores — UI con dos métricas:
//   • Ventas (sales.status=completada + payment_status=realizado)
//   • Consignaciones (count por created_by, role = vendedor)
// Ambas tabs comparten período (semana/mes/trimestre), anchor y filtro de
// sucursal. Cada tab consume su propia RPC SECURITY DEFINER (RBAC server-side).
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Trophy, Medal, Award, TrendingUp, TrendingDown, AlertCircle,
  ChevronLeft, ChevronRight, Boxes,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  useSalesRanking,
  type RankingPeriodKey,
  type RankingEntry,
} from '@/hooks/useSalesRanking'
import {
  useConsignacionesRanking,
  type ConsignacionesRankingEntry,
} from '@/hooks/useConsignacionesRanking'

const NO_BRANCH_FILTER = '__all__'

type MetricKey = 'ventas' | 'consignaciones'

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value)
}

function PodiumIcon({ place }: { place: 1 | 2 | 3 }) {
  const Icon = place === 1 ? Trophy : place === 2 ? Medal : Award
  const color = place === 1 ? 'text-yellow-500' : place === 2 ? 'text-slate-400' : 'text-amber-700'
  return <Icon className={`h-6 w-6 ${color}`} aria-hidden />
}

function PodiumRing(place: 1 | 2 | 3) {
  return place === 1 ? 'ring-yellow-500' : place === 2 ? 'ring-slate-400' : 'ring-amber-700'
}

function SalesPodiumCard({ entry, place }: { entry: RankingEntry; place: 1 | 2 | 3 }) {
  return (
    <Card className={`ring-2 ${PodiumRing(place)}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <PodiumIcon place={place} />
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

function ConsignacionesPodiumCard({
  entry,
  place,
}: { entry: ConsignacionesRankingEntry; place: 1 | 2 | 3 }) {
  return (
    <Card className={`ring-2 ${PodiumRing(place)}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <PodiumIcon place={place} />
          <span className="text-2xl font-bold text-muted-foreground">#{place}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-semibold truncate" title={entry.seller_name}>{entry.seller_name}</div>
        {entry.branch_name && (
          <div className="text-xs text-muted-foreground truncate">{entry.branch_name}</div>
        )}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{entry.consignaciones_count}</span>
          <span className="text-xs text-muted-foreground">consignaciones</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {entry.publicadas_count} publicadas · {entry.vendidas_count} vendidas
        </div>
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

function ErrorCard({ error }: { error: Error }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-6 text-sm text-rose-600">
        <AlertCircle className="h-5 w-5" aria-hidden />
        <span>No se pudo cargar el ranking: {error.message}</span>
      </CardContent>
    </Card>
  )
}

export default function SalespersonRanking() {
  const { user } = useAuth()
  const [metric, setMetric] = useState<MetricKey>('ventas')
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
  const queriesEnabled = !!user && !restrictedRole

  const sales = useSalesRanking(period, effectiveBranchId, {
    enabled: queriesEnabled && metric === 'ventas',
    anchor,
  })
  const consig = useConsignacionesRanking(period, effectiveBranchId, {
    enabled: queriesEnabled && metric === 'consignaciones',
    anchor,
  })

  const salesRows = sales.data?.rows ?? []
  const consigRows = consig.data?.rows ?? []
  const rangeLabel = sales.data?.range.label ?? consig.data?.range.label ?? ''

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

      <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
        <TabsList>
          <TabsTrigger value="ventas" className="gap-2">
            <Trophy className="h-3.5 w-3.5" aria-hidden /> Ventas
          </TabsTrigger>
          <TabsTrigger value="consignaciones" className="gap-2">
            <Boxes className="h-3.5 w-3.5" aria-hidden /> Consignaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="mt-6 space-y-6">
          {sales.error && <ErrorCard error={sales.error as Error} />}

          {salesRows.length >= 3 && salesRows[0].sales_count > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SalesPodiumCard entry={salesRows[0]} place={1} />
              <SalesPodiumCard entry={salesRows[1]} place={2} />
              <SalesPodiumCard entry={salesRows[2]} place={3} />
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
              {sales.isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
              ) : salesRows.length === 0 ? (
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
                    {salesRows.map((r) => {
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
        </TabsContent>

        <TabsContent value="consignaciones" className="mt-6 space-y-6">
          {consig.error && <ErrorCard error={consig.error as Error} />}

          {consigRows.length >= 3 && consigRows[0].consignaciones_count > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ConsignacionesPodiumCard entry={consigRows[0]} place={1} />
              <ConsignacionesPodiumCard entry={consigRows[1]} place={2} />
              <ConsignacionesPodiumCard entry={consigRows[2]} place={3} />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Tabla completa</CardTitle>
              <CardDescription>
                Cuenta por creador (rol vendedor). Desempate: publicadas, luego nombre.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {consig.isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
              ) : consigRows.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No hay consignaciones cargadas en esta vista.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead className="text-right">Consignaciones</TableHead>
                      <TableHead className="text-right">Publicadas</TableHead>
                      <TableHead className="text-right">Vendidas</TableHead>
                      <TableHead className="text-right">Δ vs anterior</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consigRows.map((r) => {
                      const isMe = user?.role === 'vendedor' && r.seller_id === user.id
                      return (
                        <TableRow key={r.seller_key} className={isMe ? 'bg-primary/5' : undefined}>
                          <TableCell className="font-semibold">{r.position}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{r.seller_name}</span>
                              {isMe && <Badge className="text-[10px]">tú</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.branch_name ?? '—'}</TableCell>
                          <TableCell className="text-right font-semibold">{r.consignaciones_count}</TableCell>
                          <TableCell className="text-right">{r.publicadas_count}</TableCell>
                          <TableCell className="text-right">{r.vendidas_count}</TableCell>
                          <TableCell className="text-right"><DeltaBadge delta={r.delta_count} /></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
