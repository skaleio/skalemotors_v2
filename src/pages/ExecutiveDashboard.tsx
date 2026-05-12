import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/ui/kpi-card";
import { FinanceMonthSelector, getCurrentPeriod } from "@/components/finance/FinanceMonthSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats, type DashboardSelectedMonth } from "@/hooks/useDashboardStats";
import { formatCLP } from "@/lib/format";
import { CHART_PALETTE, CHART_PRIMARY, CHART_TOOLTIP_PROPS } from "@/lib/chartPalette";
import { ArrowUpRight, BarChart3, Calendar, Car, ChevronRight, DollarSign, PieChart as PieChartIcon, Receipt, TrendingUp, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Paleta de 12 colores para la pie de gastos: CHART_PALETTE + variantes a 0.7 opacidad. */
const COLORS_GASTOS = [
  ...CHART_PALETTE,
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--info) / 0.7)",
  "hsl(var(--success) / 0.7)",
  "hsl(var(--warning) / 0.7)",
  "hsl(var(--destructive) / 0.7)",
  "hsl(265 70% 60% / 0.7)",
];

function ChartEmptyState({
  icon: Icon,
  title,
  description,
  linkTo,
  linkLabel,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="h-[320px] flex flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl p-5 bg-muted mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[240px] mb-5">{description}</p>
      {linkTo && linkLabel && (
        <Link
          to={linkTo}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[320px] flex flex-col justify-center p-4 space-y-4">
      <Skeleton className="h-[200px] w-full rounded-lg" />
      <div className="flex gap-2 justify-center">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-4 w-14 rounded" />
      </div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<DashboardSelectedMonth>(() => {
    const p = getCurrentPeriod();
    return { year: p.year, month: p.month - 1 };
  });
  const { data: stats, isLoading, error } = useDashboardStats(user?.branch_id, selectedMonth, user?.id);

  const financePeriod = { year: selectedMonth.year, month: selectedMonth.month + 1 };
  const onFinancePeriodChange = (p: { year: number; month: number }) =>
    setSelectedMonth({ year: p.year, month: p.month - 1 });

  const periodLabel = stats?.selectedMonthLabel ?? "";

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center space-y-4">
          <p className="text-destructive">Error al cargar las estadísticas</p>
          <p className="text-sm text-muted-foreground">Por favor, intenta recargar la página</p>
        </div>
      </div>
    );
  }

  const conversionRate = stats?.activeLeads && stats?.salesThisMonth
    ? ((stats.salesThisMonth / stats.activeLeads) * 100).toFixed(1)
    : '0';

  const showSkeleton = isLoading && !stats;

  const categoryLabels: Record<string, string> = {
    nuevo: 'Nuevos',
    usado: 'Usados',
    consignado: 'Consignados'
  };

  const expenseTypeLabels: Record<string, string> = {
    operacion: 'Operación',
    marketing: 'Marketing',
    servicios: 'Servicios',
    arriendo: 'Arriendo',
    sueldos: 'Sueldos',
    mantenimiento: 'Mantenimiento',
    combustible: 'Combustible',
    comida: 'Comida',
    uber: 'Uber',
    personal: 'Personal',
    vehiculos: 'Vehículos',
    otros: 'Otros'
  };

  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number }) => {
    if (percent < 0.10) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-semibold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
        {`${Math.round(percent * 100)}%`}
      </text>
    );
  };

  const statusLabels: Record<string, string> = {
    nuevo: 'Nuevos',
    contactado: 'Contactados',
    interesado: 'Interesados',
    cotizando: 'Cotizando',
    negociando: 'Negociando',
    vendido: 'Vendidos',
    perdido: 'Perdidos'
  };

  const hasAnyData = Boolean(
    (stats?.salesByMonth?.length) || (stats?.vehiclesByCategory?.length) || (stats?.expensesByType?.length) ||
    (stats?.leadsByStatus?.length) || (stats?.recentSales?.length)
  );

  const avgTicket = stats?.salesThisMonth && stats.salesThisMonth > 0
    ? Math.round(stats.salesRevenue / stats.salesThisMonth)
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard ejecutivo</h1>
          <p className="text-muted-foreground mt-2">
            {hasAnyData
              ? "Métricas y gráficos del período seleccionado. Inventario y pipeline son estado actual."
              : "Elegí un mes o cargá datos en Ventas, Inventario y Gastos para ver métricas."}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Período</span>
          <FinanceMonthSelector period={financePeriod} onPeriodChange={onFinancePeriodChange} />
        </div>
      </div>

      {/* KPIs superiores */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Ingresos totales"
          icon={DollarSign}
          loading={showSkeleton}
          loadingWidth="lg"
          value={stats ? formatCLP(stats.totalIncomeMonth ?? 0) : ""}
          subtitle={`Ingresos · ${periodLabel || "—"}`}
        />
        <KPICard
          label="Vehículos vendidos"
          icon={Car}
          loading={showSkeleton}
          loadingWidth="sm"
          value={stats?.salesThisMonth ?? 0}
          subtitle={`Ventas · ${periodLabel || "—"}`}
        />
        <KPICard
          label="Tasa de conversión"
          icon={TrendingUp}
          loading={showSkeleton}
          loadingWidth="sm"
          value={`${conversionRate}%`}
          subtitle="Ventas del mes vs leads actuales"
        />
        <KPICard
          label="Clientes activos"
          icon={Users}
          loading={showSkeleton}
          loadingWidth="sm"
          value={stats?.activeLeads ?? 0}
          subtitle="Activos hoy (no por mes)"
        />
      </div>

      {/* Charts principales */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Análisis de ventas
              </CardTitle>
              <p className="text-xs text-muted-foreground">6 meses hasta {periodLabel || "…"}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {showSkeleton ? (
              <ChartSkeleton />
            ) : stats?.salesByMonth && stats.salesByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={stats.salesByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorSalesExec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_PROPS}
                    contentStyle={{ ...CHART_TOOLTIP_PROPS.contentStyle, padding: "12px" }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Ventas') return [value, 'Ventas'];
                      return [formatCLP(value), 'Ingresos'];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    dot={{ fill: CHART_PRIMARY, r: 3, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    fill="url(#colorSalesExec)"
                    name="Ventas"
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--success))', r: 3, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    name="Ingresos"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyState
                icon={BarChart3}
                title="Sin datos de ventas"
                description="Cuando registres ventas completadas, aquí verás la tendencia de los últimos 6 meses."
                linkTo="/app/sales"
                linkLabel="Ir a Ventas"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                Distribución por categoría
              </CardTitle>
              <p className="text-xs text-muted-foreground">Inventario actual</p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {showSkeleton ? (
              <ChartSkeleton />
            ) : stats?.vehiclesByCategory && stats.vehiclesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart margin={{ top: 4, right: 4, bottom: 40, left: 4 }}>
                  <Pie
                    data={stats.vehiclesByCategory.map(item => ({
                      ...item,
                      name: categoryLabels[item.category] || item.category
                    }))}
                    cx="50%"
                    cy="48%"
                    labelLine={false}
                    label={renderPieLabel}
                    outerRadius={116}
                    dataKey="count"
                    paddingAngle={0}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {stats.vehiclesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_TOOLTIP_PROPS}
                    contentStyle={{ ...CHART_TOOLTIP_PROPS.contentStyle, borderRadius: "10px" }}
                    formatter={(value: number, name: string) => {
                      const total = stats!.vehiclesByCategory.reduce((s, i) => s + i.count, 0);
                      const pct = total ? Math.round((Number(value) / total) * 100) : 0;
                      return [`${value} vehículos (${pct}%)`, name];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={32}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ paddingTop: 4 }}
                    formatter={(value) => <span className="text-xs font-medium text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyState
                icon={Car}
                title="Sin vehículos en inventario"
                description="Al cargar vehículos (nuevos, usados o consignados), aquí verás la distribución por categoría."
                linkTo="/app/consignaciones"
                linkLabel="Ir a Consignaciones"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Distribución de gastos
              </CardTitle>
              <p className="text-xs text-muted-foreground">Gastos en {periodLabel || "el período"}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {showSkeleton ? (
              <ChartSkeleton />
            ) : stats?.expensesByType && stats.expensesByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart margin={{ top: 4, right: 4, bottom: 40, left: 4 }}>
                  <Pie
                    data={stats.expensesByType.map(item => ({
                      ...item,
                      name: expenseTypeLabels[item.type] || item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase()
                    }))}
                    cx="50%"
                    cy="48%"
                    labelLine={false}
                    label={renderPieLabel}
                    outerRadius={116}
                    dataKey="amount"
                    paddingAngle={0}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {stats.expensesByType.map((entry, index) => (
                      <Cell key={`cell-exp-${index}`} fill={COLORS_GASTOS[index % COLORS_GASTOS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...CHART_TOOLTIP_PROPS}
                    contentStyle={{ ...CHART_TOOLTIP_PROPS.contentStyle, borderRadius: "10px" }}
                    formatter={(value: number, name: string) => {
                      const total = stats!.expensesByType.reduce((s, i) => s + i.amount, 0);
                      const pct = total ? Math.round((Number(value) / total) * 100) : 0;
                      return [`${formatCLP(Number(value))} (${pct}%)`, name];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={32}
                    iconType="circle"
                    iconSize={8}
                    layout="horizontal"
                    wrapperStyle={{ paddingTop: 4, flexWrap: 'wrap', justifyContent: 'center', gap: '4px 12px' }}
                    formatter={(value) => <span className="text-[11px] font-medium text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyState
                icon={Receipt}
                title="Sin gastos registrados"
                description="Al cargar gastos por tipo (operación, marketing, etc.), aquí verás la distribución."
                linkTo="/app/finance"
                linkLabel="Ir a Gastos/Ingresos"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline + Ventas Recientes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="h-4 w-4 text-muted-foreground" />
                Pipeline de ventas
              </CardTitle>
              <CardDescription className="text-xs">Leads por estado del proceso</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {showSkeleton ? (
              <ChartSkeleton />
            ) : stats?.leadsByStatus && stats.leadsByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={stats.leadsByStatus.map(item => ({
                    ...item,
                    name: statusLabels[item.status] || item.status
                  }))}
                  margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                >
                  <defs>
                    <linearGradient id="colorBarExec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.9} />
                      <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 500 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_PROPS}
                    contentStyle={{ ...CHART_TOOLTIP_PROPS.contentStyle, padding: "12px" }}
                    formatter={(value: any) => [value, 'Leads']}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#colorBarExec)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmptyState
                icon={Users}
                title="Sin leads en el pipeline"
                description="Cuando tengas leads por estado (contactado, cotizando, etc.), aquí verás el funnel."
                linkTo="/app/leads"
                linkLabel="Ir a Leads"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Ventas recientes
              </CardTitle>
              <CardDescription className="text-xs">Hasta 5 ventas en {periodLabel || "el período"}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {showSkeleton ? (
              <ChartSkeleton />
            ) : stats?.recentSales && stats.recentSales.length > 0 ? (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {stats.recentSales.map((sale, index) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground font-medium text-sm shrink-0 skale-num">
                        {index + 1}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-medium truncate">{sale.vehicle}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {sale.seller}
                          </span>
                          <span className="opacity-50">•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(sale.date).toLocaleDateString('es-CL', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-success skale-num shrink-0 ml-3">
                      {formatCLP(sale.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <ChartEmptyState
                icon={DollarSign}
                title="Sin ventas recientes"
                description="Las últimas 5 ventas completadas aparecerán aquí para un vistazo rápido."
                linkTo="/app/sales"
                linkLabel="Ir a Ventas"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas adicionales */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          label="Ticket promedio"
          icon={TrendingUp}
          loading={showSkeleton}
          loadingWidth="lg"
          value={stats ? formatCLP(avgTicket) : ""}
          subtitle="Por vehículo vendido"
        />
        <KPICard
          label="Stock disponible"
          icon={Car}
          loading={showSkeleton}
          loadingWidth="sm"
          value={stats?.availableVehicles ?? 0}
          subtitle={stats ? `De ${stats.totalVehicles || 0} totales` : undefined}
        />
        <KPICard
          label="Tasa de cierre"
          icon={Trophy}
          loading={showSkeleton}
          loadingWidth="sm"
          value={`${conversionRate}%`}
          subtitle={
            <span className="inline-flex items-center gap-1 text-success">
              <ArrowUpRight className="h-3 w-3" />
              Excelente
            </span>
          }
        />
      </div>
    </div>
  );
}
