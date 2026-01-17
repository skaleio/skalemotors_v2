import { useMemo, lazy, Suspense } from "react";
import { 
  Car, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Package, 
  BarChart3,
  PieChart,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicles } from "@/hooks/useVehicles";
import { formatCLP } from "@/lib/format";
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";

// Paleta de colores mejorada
const COLORS = {
  disponible: "#10b981", // Verde esmeralda
  reservado: "#f59e0b",  // Ámbar
  vendido: "#3b82f6",    // Azul
  ingreso: "#8b5cf6",    // Violeta
  nuevo: "#0ea5e9",      // Azul cielo
  usado: "#22c55e",      // Verde
  consignado: "#eab308", // Amarillo
  primary: "#6366f1",    // Índigo
  secondary: "#ec4899",  // Rosa
  tertiary: "#14b8a6",   // Verde azulado
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-lg">
        <p className="font-medium text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs flex items-center gap-2" style={{ color: entry.color || entry.fill }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></span>
            <span>{entry.name}: </span>
            <span className="font-semibold">
              {typeof entry.value === 'number' && entry.name.toLowerCase().includes('valor') || entry.name.toLowerCase().includes('costo') || entry.name.toLowerCase().includes('margen') 
                ? formatCLP(entry.value) 
                : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdvancedInventory() {
  const { user } = useAuth();
  const { vehicles, loading } = useVehicles({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });

  // Calcular métricas
  const metrics = useMemo(() => {
    if (!vehicles.length) {
      return {
        total: 0,
        totalValue: 0,
        totalCost: 0,
        totalMargin: 0,
        avgMargin: 0,
        avgMarginPercent: 0,
        byStatus: {},
        byCategory: {},
        byMake: {},
        oldestDays: 0,
        avgDaysInInventory: 0,
      };
    }

    const total = vehicles.length;
    const totalValue = vehicles.reduce((sum, v) => sum + Number(v.price || 0), 0);
    const totalCost = vehicles.reduce((sum, v) => sum + Number(v.cost || 0), 0);
    const totalMargin = totalValue - totalCost;
    const avgMargin = totalMargin / total;
    const avgMarginPercent = totalValue > 0 ? (totalMargin / totalValue) * 100 : 0;

    // Por estado
    const byStatus = vehicles.reduce((acc, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Por categoría
    const byCategory = vehicles.reduce((acc, v) => {
      acc[v.category] = (acc[v.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Por marca
    const byMake = vehicles.reduce((acc, v) => {
      const make = v.make || "Sin marca";
      acc[make] = (acc[make] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Días en inventario
    const now = new Date();
    const daysInInventory = vehicles
      .filter(v => v.arrival_date)
      .map(v => {
        const arrival = new Date(v.arrival_date!);
        return Math.floor((now.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
      });

    const oldestDays = daysInInventory.length > 0 ? Math.max(...daysInInventory) : 0;
    const avgDaysInInventory = daysInInventory.length > 0
      ? Math.floor(daysInInventory.reduce((a, b) => a + b, 0) / daysInInventory.length)
      : 0;

    return {
      total,
      totalValue,
      totalCost,
      totalMargin,
      avgMargin,
      avgMarginPercent,
      byStatus,
      byCategory,
      byMake,
      oldestDays,
      avgDaysInInventory,
    };
  }, [vehicles]);

  // Preparar datos para gráficos
  const statusChartData = useMemo(() => {
    return Object.entries(metrics.byStatus).map(([status, count]) => ({
      name: status === 'disponible' ? 'Disponible' :
            status === 'reservado' ? 'Reservado' :
            status === 'vendido' ? 'Vendido' :
            status === 'ingreso' ? 'En Ingreso' : status,
      value: count,
      color: COLORS[status as keyof typeof COLORS] || "#6b7280"
    }));
  }, [metrics.byStatus]);

  const categoryChartData = useMemo(() => {
    return Object.entries(metrics.byCategory).map(([category, count]) => ({
      name: category === 'nuevo' ? 'Nuevo' :
            category === 'usado' ? 'Usado' :
            category === 'consignado' ? 'Consignado' : category,
      value: count,
      color: COLORS[category as keyof typeof COLORS] || "#6b7280"
    }));
  }, [metrics.byCategory]);

  const makeChartData = useMemo(() => {
    return Object.entries(metrics.byMake)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([make, count]) => ({
        name: make,
        cantidad: count
      }));
  }, [metrics.byMake]);

  // Vehículos más antiguos
  const oldestVehicles = useMemo(() => {
    return vehicles
      .filter(v => v.arrival_date)
      .map(v => {
        const arrival = new Date(v.arrival_date!);
        const days = Math.floor((new Date().getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
        return { ...v, daysInInventory: days };
      })
      .sort((a, b) => b.daysInInventory - a.daysInInventory)
      .slice(0, 5);
  }, [vehicles]);

  // Análisis de valor por categoría
  const valueByCategory = useMemo(() => {
    const categories = ['nuevo', 'usado', 'consignado'];
    return categories.map(category => {
      const categoryVehicles = vehicles.filter(v => v.category === category);
      const totalValue = categoryVehicles.reduce((sum, v) => sum + Number(v.price || 0), 0);
      const totalCost = categoryVehicles.reduce((sum, v) => sum + Number(v.cost || 0), 0);
      const margin = totalValue - totalCost;
      
      return {
        name: category === 'nuevo' ? 'Nuevo' :
              category === 'usado' ? 'Usado' :
              category === 'consignado' ? 'Consignado' : category,
        valor: totalValue,
        costo: totalCost,
        margen: margin,
        cantidad: categoryVehicles.length
      };
    }).filter(item => item.cantidad > 0);
  }, [vehicles]);

  // Distribución de precios
  const priceDistribution = useMemo(() => {
    const ranges = [
      { name: "0-5M", min: 0, max: 5000000 },
      { name: "5-10M", min: 5000000, max: 10000000 },
      { name: "10-15M", min: 10000000, max: 15000000 },
      { name: "15-20M", min: 15000000, max: 20000000 },
      { name: "20M+", min: 20000000, max: Infinity },
    ];

    return ranges.map(range => ({
      name: range.name,
      cantidad: vehicles.filter(v => {
        const price = Number(v.price || 0);
        return price >= range.min && price < range.max;
      }).length
    }));
  }, [vehicles]);

  // Componente de skeleton para KPI cards
  const KPISkeleton = () => (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );

  // Componente de skeleton para gráficos
  const ChartSkeleton = () => (
    <Card className="hover:shadow-sm transition-shadow">
      <CardHeader>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventario Avanzado</h1>
        <p className="text-muted-foreground">
          Análisis detallado y métricas clave de tu inventario
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
            <KPISkeleton />
          </>
        ) : (
          <>
            <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Vehículos</CardTitle>
                <div className="p-2 bg-blue-100 rounded-full">
                  <Car className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.total}</div>
                <p className="text-xs text-muted-foreground">
                  en inventario
                </p>
              </CardContent>
            </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <div className="p-2 bg-green-100 rounded-full">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCLP(metrics.totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              precio de lista
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen Total</CardTitle>
            <div className="p-2 bg-amber-100 rounded-full">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCLP(metrics.totalMargin)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.avgMarginPercent.toFixed(1)}% margen promedio
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Días Promedio</CardTitle>
            <div className="p-2 bg-purple-100 rounded-full">
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgDaysInInventory}</div>
            <p className="text-xs text-muted-foreground">
              en inventario
            </p>
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {/* Gráficos principales */}
      <div className="grid gap-6 md:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {/* Distribución por Estado */}
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Distribución por Estado
                </CardTitle>
                <CardDescription>
                  Vehículos agrupados por estado actual
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-sm text-muted-foreground ml-1">{value}</span>}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay datos para mostrar</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribución por Categoría */}
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Distribución por Categoría
            </CardTitle>
            <CardDescription>
              Vehículos agrupados por tipo (Nuevo, Usado, Consignado)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryChartData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay datos para mostrar</p>
                </div>
              </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Top Marcas y Distribución de Precios */}
      <div className="grid gap-6 md:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            {/* Top 10 Marcas */}
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Top 10 Marcas
                </CardTitle>
                <CardDescription>
                  Marcas con más vehículos en inventario
                </CardDescription>
              </CardHeader>
              <CardContent>
                {makeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={makeChartData} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" axisLine={false} tickLine={false} hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="cantidad" fill={COLORS.tertiary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay datos para mostrar</p>
                </div>
              </div>
                )}
              </CardContent>
            </Card>

            {/* Distribución de Precios */}
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Distribución de Precios
                </CardTitle>
                <CardDescription>
                  Cantidad de vehículos por rango de precio
                </CardDescription>
              </CardHeader>
              <CardContent>
                {priceDistribution.some(p => p.cantidad > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={priceDistribution}>
                  <defs>
                    <linearGradient id="colorPrecio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6b7280', fontSize: 12 }} 
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="cantidad" 
                    stroke={COLORS.secondary} 
                    fillOpacity={1} 
                    fill="url(#colorPrecio)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay datos para mostrar</p>
                </div>
              </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Análisis de Valor por Categoría */}
      {loading ? (
        <ChartSkeleton />
      ) : (
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Análisis de Valor por Categoría
            </CardTitle>
            <CardDescription>
              Comparación de valor, costo y margen por tipo de vehículo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {valueByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={valueByCategory} barGap={0} barSize={30}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `$${(value/1000000).toFixed(0)}M`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '20px' }}
                />
                <Bar dataKey="valor" fill={COLORS.vendido} name="Valor Total" radius={[4, 4, 0, 0]} />
                <Bar dataKey="costo" fill="#9ca3af" name="Costo Total" radius={[4, 4, 0, 0]} />
                <Bar dataKey="margen" fill={COLORS.disponible} name="Margen Total" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay datos para mostrar</p>
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vehículos más antiguos en inventario */}
      {!loading && oldestVehicles.length > 0 && (
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Vehículos más Antiguos en Inventario
            </CardTitle>
            <CardDescription>
              Vehículos que llevan más tiempo sin venderse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {oldestVehicles.map((vehicle, index) => (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold shadow-sm transition-transform group-hover:scale-110 ${
                      index === 0 ? 'bg-red-100 text-red-600' :
                      index === 1 ? 'bg-orange-100 text-orange-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground/90">
                        {vehicle.make} {vehicle.model} {vehicle.year}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        VIN: {vehicle.vin} • {formatCLP(Number(vehicle.price || 0))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-lg text-slate-700">
                        {vehicle.daysInInventory} días
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        en inventario
                      </div>
                    </div>
                    <Badge variant="outline" className={`
                      ${vehicle.status === 'disponible' ? 'bg-green-50 text-green-700 border-green-200' : 
                        vehicle.status === 'reservado' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                        'bg-slate-50 text-slate-700 border-slate-200'}
                    `}>
                      {vehicle.status === 'disponible' ? 'Disponible' :
                       vehicle.status === 'reservado' ? 'Reservado' :
                       vehicle.status === 'vendido' ? 'Vendido' : vehicle.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen de métricas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Resumen Financiero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
              <span className="text-sm font-medium text-slate-600">Valor Total</span>
              <span className="font-bold text-slate-900">{formatCLP(metrics.totalValue)}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
              <span className="text-sm font-medium text-slate-600">Costo Total</span>
              <span className="font-bold text-slate-900">{formatCLP(metrics.totalCost)}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center p-2 rounded bg-green-50/50">
                <span className="text-sm font-medium text-green-700">Margen Total</span>
                <span className="font-bold text-green-700">{formatCLP(metrics.totalMargin)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-2">
              <span className="text-sm text-muted-foreground">Margen Promedio</span>
              <span className="font-semibold text-green-600">{metrics.avgMarginPercent.toFixed(2)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Resumen de Estados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            {Object.entries(metrics.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[status as keyof typeof COLORS] || '#94a3b8' }}></div>
                  <span className="text-sm font-medium text-slate-600 capitalize">
                    {status === 'disponible' ? 'Disponible' :
                     status === 'reservado' ? 'Reservado' :
                     status === 'vendido' ? 'Vendido' :
                     status === 'ingreso' ? 'En Ingreso' : status}
                  </span>
                </div>
                <Badge variant="secondary" className="font-mono">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Resumen de Categorías</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2">
            {Object.entries(metrics.byCategory).map(([category, count]) => (
              <div key={category} className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[category as keyof typeof COLORS] || '#94a3b8' }}></div>
                  <span className="text-sm font-medium text-slate-600 capitalize">
                    {category === 'nuevo' ? 'Nuevo' :
                     category === 'usado' ? 'Usado' :
                     category === 'consignado' ? 'Consignado' : category}
                  </span>
                </div>
                <Badge variant="secondary" className="font-mono">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
