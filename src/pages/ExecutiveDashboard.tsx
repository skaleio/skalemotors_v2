import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceMonthSelector, getCurrentPeriod } from "@/components/finance/FinanceMonthSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats, type DashboardSelectedMonth } from "@/hooks/useDashboardStats";
import { formatCLP } from "@/lib/format";
import { ArrowUpRight, BarChart3, Calendar, Car, ChevronRight, DollarSign, PieChart as PieChartIcon, Receipt, TrendingUp, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Tooltip legible en claro y oscuro (Recharts por defecto pinta texto oscuro). */
const EXEC_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    boxShadow: "0 10px 24px -4px rgb(0 0 0 / 0.2)",
    padding: "10px 14px",
  },
  labelStyle: {
    color: "hsl(var(--popover-foreground))",
    fontWeight: 600 as const,
    marginBottom: 4,
  },
  itemStyle: {
    color: "hsl(var(--popover-foreground))",
  },
};

function ChartEmptyState({
  icon: Icon,
  title,
  description,
  linkTo,
  linkLabel,
  iconBgClass = "bg-muted",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  linkTo?: string;
  linkLabel?: string;
  iconBgClass?: string;
}) {
  return (
    <div className="h-[320px] flex flex-col items-center justify-center px-6 text-center">
      <div className={`rounded-2xl p-5 ${iconBgClass} mb-4`}>
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const COLORS_GASTOS = [
    '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777',
    '#0891b2', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#ca8a04'
  ];

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Ejecutivo</h1>
          <p className="text-muted-foreground mt-2">
            {hasAnyData
              ? `Métricas y gráficos del período seleccionado. Inventario y pipeline son estado actual.`
              : "Elige un mes o carga datos en Ventas, Inventario y Gastos para ver métricas."}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Período</span>
          <FinanceMonthSelector period={financePeriod} onPeriodChange={onFinancePeriodChange} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {showSkeleton ? <Skeleton className="h-8 w-28" /> : <div className="text-2xl font-bold">{formatCLP(stats?.totalIncomeMonth ?? 0)}</div>}
            <p className="text-xs text-muted-foreground">Ingresos · {periodLabel || "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehículos Vendidos</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {showSkeleton ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats?.salesThisMonth || 0}</div>}
            <p className="text-xs text-muted-foreground">Ventas · {periodLabel || "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {showSkeleton ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{conversionRate}%</div>}
            <p className="text-xs text-muted-foreground">Ventas del mes vs leads actuales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {showSkeleton ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats?.activeLeads || 0}</div>}
            <p className="text-xs text-muted-foreground">Activos hoy (no por mes)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Análisis de Ventas */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-white" />
                  </div>
                  Análisis de Ventas
                </CardTitle>
                <p className="text-xs text-muted-foreground">6 meses hasta {periodLabel || "…"}</p>
              </div>
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
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                    {...EXEC_TOOLTIP_PROPS}
                    contentStyle={{ ...EXEC_TOOLTIP_PROPS.contentStyle, padding: "12px" }}
                    formatter={(value: any, name: string) => {
                      if (name === 'sales') return [value, 'Ventas'];
                      return [formatCLP(value), 'Ingresos'];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', r: 4, strokeWidth: 3, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
                    fill="url(#colorSalesExec)"
                    name="Ventas"
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
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
                iconBgClass="bg-blue-500/10"
              />
            )}
          </CardContent>
        </Card>

        {/* Distribución por Categoría */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <PieChartIcon className="h-4 w-4 text-white" />
                  </div>
                  Distribución por Categoría
                </CardTitle>
                <p className="text-xs text-muted-foreground">Inventario actual</p>
              </div>
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
                    fill="#8884d8"
                    dataKey="count"
                    paddingAngle={0}
                    stroke="none"
                  >
                    {stats.vehiclesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...EXEC_TOOLTIP_PROPS}
                    contentStyle={{ ...EXEC_TOOLTIP_PROPS.contentStyle, borderRadius: "10px" }}
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
                iconBgClass="bg-purple-500/10"
              />
            )}
          </CardContent>
        </Card>

        {/* Distribución de Gastos */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-rose-500 rounded-lg">
                    <Receipt className="h-4 w-4 text-white" />
                  </div>
                  Distribución de Gastos
                </CardTitle>
                <p className="text-xs text-muted-foreground">Gastos en {periodLabel || "el período"}</p>
              </div>
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
                    fill="#8884d8"
                    dataKey="amount"
                    paddingAngle={0}
                    stroke="none"
                  >
                    {stats.expensesByType.map((entry, index) => (
                      <Cell key={`cell-exp-${index}`} fill={COLORS_GASTOS[index % COLORS_GASTOS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...EXEC_TOOLTIP_PROPS}
                    contentStyle={{ ...EXEC_TOOLTIP_PROPS.contentStyle, borderRadius: "10px" }}
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
                iconBgClass="bg-rose-500/10"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline de Ventas y Ventas Recientes */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline de Ventas (Leads por Estado) */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  Pipeline de Ventas
                </CardTitle>
                <CardDescription className="text-xs">Leads por estado del proceso</CardDescription>
              </div>
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
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.6} />
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
                    {...EXEC_TOOLTIP_PROPS}
                    contentStyle={{ ...EXEC_TOOLTIP_PROPS.contentStyle, padding: "12px" }}
                    formatter={(value: any) => [value, 'Leads']}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#colorBarExec)"
                    radius={[8, 8, 0, 0]}
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
                iconBgClass="bg-green-500/10"
              />
            )}
          </CardContent>
        </Card>

        {/* Ventas Recientes */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-amber-500 rounded-lg">
                    <DollarSign className="h-4 w-4 text-white" />
                  </div>
                  Ventas Recientes
                </CardTitle>
                <CardDescription className="text-xs">Hasta 5 ventas en {periodLabel || "el período"}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {showSkeleton ? (
              <ChartSkeleton />
            ) : stats?.recentSales && stats.recentSales.length > 0 ? (
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {stats.recentSales.map((sale, index) => (
                  <div
                    key={sale.id}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-green-500/30 hover:bg-green-50/30 dark:hover:bg-green-950/10 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20 text-white font-bold text-sm flex-shrink-0">
                        {index + 1}
                        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-sm font-semibold tracking-tight">{sale.vehicle}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium">
                            <Users className="h-3 w-3" />
                            {sale.seller}
                          </span>
                          <span className="text-muted-foreground/50">•</span>
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
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-green-600 dark:text-green-400 tracking-tight">
                        {formatCLP(sale.amount)}
                      </p>
                    </div>
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
                iconBgClass="bg-amber-500/10"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Métricas Adicionales */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Promedio de Venta */}
        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticket Promedio</CardTitle>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {showSkeleton ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <div className="text-3xl font-bold tracking-tight">
                {stats?.salesThisMonth && stats.salesThisMonth > 0
                  ? formatCLP(Math.round(stats.salesRevenue / stats.salesThisMonth))
                  : formatCLP(0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground font-medium">
              Por vehículo vendido
            </p>
          </CardContent>
        </Card>

        {/* Inventario Disponible */}
        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Disponible</CardTitle>
            </div>
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg shadow-purple-500/20">
              <Car className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {showSkeleton ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <div className="text-3xl font-bold tracking-tight">{stats?.availableVehicles || 0}</div>
            )}
            <p className="text-xs text-muted-foreground font-medium">
              De {showSkeleton ? "—" : (stats?.totalVehicles || 0)} totales
            </p>
          </CardContent>
        </Card>

        {/* Tasa de Cierre */}
        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-white to-green-50/30 dark:from-gray-900 dark:to-green-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-16 -mt-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasa de Cierre</CardTitle>
            </div>
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg shadow-green-500/20">
              <Trophy className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {showSkeleton ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="text-3xl font-bold tracking-tight">{conversionRate}%</div>
            )}
            <div className="flex items-center gap-1 text-xs">
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Excelente
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
