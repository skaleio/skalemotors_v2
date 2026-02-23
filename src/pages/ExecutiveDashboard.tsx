import DashboardLoader from "@/components/DashboardLoader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatCLP } from "@/lib/format";
import { ArrowUpRight, BarChart3, Calendar, Car, DollarSign, PieChart as PieChartIcon, Receipt, TrendingUp, Trophy, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading, error } = useDashboardStats(user?.branch_id);

  console.log('📊 ExecutiveDashboard - user:', user);
  console.log('📊 ExecutiveDashboard - branch_id:', user?.branch_id);
  console.log('📊 ExecutiveDashboard - stats:', stats);
  console.log('📊 ExecutiveDashboard - isLoading:', isLoading);
  console.log('📊 ExecutiveDashboard - error:', error);

  if (isLoading) {
    return <DashboardLoader message="Cargando estadísticas ejecutivas" />;
  }

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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
    otros: 'Otros'
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Ejecutivo</h1>
        <p className="text-muted-foreground mt-2">
          Vista ejecutiva de métricas y KPIs
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCLP(stats?.salesRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehículos Vendidos</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.salesThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">Leads a ventas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeLeads || 0}</div>
            <p className="text-xs text-muted-foreground">En conversión</p>
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
                <p className="text-xs text-muted-foreground">Tendencia últimos 6 meses</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.salesByMonth && stats.salesByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={stats.salesByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorSalesExec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'sales') return [value, 'Ventas'];
                      return [formatCLP(value), 'Ingresos'];
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
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
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay datos de ventas disponibles</p>
              </div>
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
            {stats?.vehiclesByCategory && stats.vehiclesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={stats.vehiclesByCategory.map(item => ({
                      ...item,
                      name: categoryLabels[item.category] || item.category
                    }))}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          className="text-xs font-bold"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    paddingAngle={0}
                    stroke="none"
                  >
                    {stats.vehiclesByCategory.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <Car className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay vehículos en inventario</p>
              </div>
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
                <p className="text-xs text-muted-foreground">Por tipo de gasto</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.expensesByType && stats.expensesByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={stats.expensesByType.map(item => ({
                      ...item,
                      name: expenseTypeLabels[item.type] || item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase()
                    }))}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                      const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          className="text-xs font-bold"
                        >
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="amount"
                    paddingAngle={0}
                    stroke="none"
                  >
                    {stats.expensesByType.map((entry, index) => (
                      <Cell
                        key={`cell-exp-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                    formatter={(value: number) => [formatCLP(value), 'Monto']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <Receipt className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay gastos registrados</p>
              </div>
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
            {stats?.leadsByStatus && stats.leadsByStatus.length > 0 ? (
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
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.6}/>
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
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      padding: '12px'
                    }}
                    formatter={(value: any) => [value, 'Leads']}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
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
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay leads registrados</p>
              </div>
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
                <CardDescription className="text-xs">Últimas 5 transacciones</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.recentSales && stats.recentSales.length > 0 ? (
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
              <div className="h-[320px] flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">No hay ventas recientes</p>
              </div>
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
            <div className="text-3xl font-bold tracking-tight">
              {stats?.salesThisMonth && stats.salesThisMonth > 0
                ? formatCLP(Math.round(stats.salesRevenue / stats.salesThisMonth))
                : formatCLP(0)}
            </div>
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
            <div className="text-3xl font-bold tracking-tight">{stats?.availableVehicles || 0}</div>
            <p className="text-xs text-muted-foreground font-medium">
              De {stats?.totalVehicles || 0} totales
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
            <div className="text-3xl font-bold tracking-tight">{conversionRate}%</div>
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
