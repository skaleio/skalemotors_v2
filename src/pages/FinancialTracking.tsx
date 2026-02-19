import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { formatCLP } from "@/lib/format";
import type { DateRangePreset } from "@/hooks/useFinancialTracking";
import { useFinancialTracking } from "@/hooks/useFinancialTracking";
import {
  BarChart3,
  Calendar,
  DollarSign,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  Car,
  Receipt,
  Info,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { expenseTypesService } from "@/lib/services/expenseTypes";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as React from "react";

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes pasado" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "this_year", label: "Este año" },
];

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function formatShortDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FinancialTracking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [datePreset, setDatePreset] = React.useState<DateRangePreset>("last_6_months");
  const { data, isLoading, error } = useFinancialTracking(user?.branch_id ?? null, datePreset);
  const { data: expenseTypes } = useQuery({
    queryKey: ["expense-types"],
    queryFn: () => expenseTypesService.getAll(),
  });

  const getExpenseTypeLabel = (code: string) =>
    expenseTypes?.find((t) => t.code === code)?.label ?? code;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Seguimiento Financiero</h1>
          <p className="text-muted-foreground mt-2">
            Monitorea la salud financiera de tu automotora con ventas, ingresos y gastos
          </p>
        </div>
        <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DateRangePreset)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-white to-emerald-50/30 dark:from-gray-900 dark:to-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-semibold">¿Para qué sirve?</p>
                  <p className="text-xs mt-1">
                    Suma de la ganancia de ventas (margen con pago realizado) más otros ingresos (ej. comisión crédito).
                    Te dice cuánto está entrando realmente a la empresa en el período.
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {isLoading ? "…" : formatCLP(data?.totalIncome ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data ? `${data.salesCount} venta(s) · ${formatCLP(data.incomeFromSales)} ganancia` : "En el período seleccionado"}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-white to-red-50/30 dark:from-gray-900 dark:to-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-semibold">¿Para qué sirve?</p>
                  <p className="text-xs mt-1">
                    Total de gastos registrados en Finanzas (operación, marketing, servicios, etc.).
                    Fundamental para no gastar más de lo que entra y planificar devoluciones a inversores.
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {isLoading ? "…" : formatCLP(data?.totalExpenses ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              En el período seleccionado
            </p>
          </CardContent>
        </Card>

        <Card className={`relative overflow-hidden border-0 shadow-sm ${(data?.balance ?? 0) >= 0 ? "bg-gradient-to-br from-white to-sky-50/30 dark:to-sky-950/20" : "bg-gradient-to-br from-white to-red-50/30 dark:to-red-950/20"}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-semibold">¿Para qué sirve?</p>
                  <p className="text-xs mt-1">
                    Ingresos menos gastos. Es el resultado real del período: si es positivo, la operación generó ganancia;
                    si es negativo, hay que ajustar gastos o aumentar ventas.
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            <Wallet className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.balance ?? 0) >= 0 ? "text-sky-700 dark:text-sky-400" : "text-red-700 dark:text-red-400"}`}>
              {isLoading ? "…" : formatCLP(data?.balance ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ingresos − Gastos
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm bg-gradient-to-br from-white to-violet-50/30 dark:from-gray-900 dark:to-violet-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen de ganancia</CardTitle>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  <p className="font-semibold">¿Para qué sirve?</p>
                  <p className="text-xs mt-1">
                    Porcentaje de utilidad sobre ingresos. Un margen sano indica que los costos están controlados
                    respecto a lo que genera la automotora.
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            <BarChart3 className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-700 dark:text-violet-400">
              {isLoading ? "…" : `${data?.marginPercent ?? 0}%`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sobre ingresos del período
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Ingresos vs Gastos</CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Comparación por mes. Te permite ver en qué meses entró más dinero y en cuáles los gastos se dispararon.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <CardDescription>Por mes en el período seleccionado</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.byMonth && data.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.byMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: number) => [formatCLP(value), ""]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <Receipt className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No hay datos en este período</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Flujo de caja (balance por mes)</CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Balance mensual (ingresos − gastos). Una línea ascendente indica meses positivos; si baja, ese mes gastaste más de lo que entró.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <CardDescription>Utilidad neta por mes</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.byMonth && data.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.byMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: number) => [formatCLP(value), "Balance"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    labelFormatter={(label) => label}
                  />
                  <Line type="monotone" dataKey="balance" name="Balance" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No hay datos en este período</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Segunda fila: Tendencia ventas, Gastos por categoría, Gastos por inversor */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Tendencia de ventas</CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Unidades vendidas y facturación por mes. Sirve para ver temporadas y metas.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <CardDescription>Unidades y monto vendido por mes</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.byMonth && data.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.byMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} tickFormatter={(v) => `${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [name === "Ventas" ? value : formatCLP(value), name]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    labelFormatter={(label) => label}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="salesCount" name="Ventas (unid.)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="salesRevenue" name="Facturación" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                <Car className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No hay datos</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Gastos por categoría</CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Distribución de gastos por tipo (operación, marketing, servicios, etc.).</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <CardDescription>En el período seleccionado</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.expensesByCategory && data.expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.expensesByCategory.map((c) => ({ ...c, name: getExpenseTypeLabel(c.type) }))}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.expensesByCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [formatCLP(v), ""]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                <Receipt className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No hay gastos</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Gastos por inversor</CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Quién pagó qué en el período. Útil para repartir devoluciones.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <CardDescription>Monto por inversor</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.expensesByInversor && data.expensesByInversor.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.expensesByInversor} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={55} />
                  <Tooltip formatter={(v: number) => [formatCLP(v), "Gasto"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                <User className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No hay gastos por inversor</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tercera fila: Desglose ingresos (Pie), Balance acumulado (Line) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Desglose de ingresos</CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Proporción entre ganancia por ventas y otros ingresos (comisión crédito, etc.).</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <CardDescription>Ventas vs otros ingresos</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data && (data.incomeFromSales > 0 || data.incomeFromOther > 0) ? (
              (() => {
                const incomePieData = [
                  { name: "Ganancia ventas", value: data.incomeFromSales },
                  { name: "Otros ingresos", value: data.incomeFromOther },
                ].filter((d) => d.value > 0);
                const colors = ["#10b981", "#3b82f6"];
                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={incomePieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {incomePieData.map((_, i) => (
                          <Cell key={i} fill={colors[i]} stroke="hsl(var(--background))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatCLP(v), ""]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No hay ingresos en el período</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Balance acumulado</CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Suma acumulada mes a mes (ingresos − gastos). Muestra la evolución del resultado en el tiempo.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <CardDescription>Resultado acumulado por mes</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.byMonth && data.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.byMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: number) => [formatCLP(value), "Acumulado"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                    labelFormatter={(label) => label}
                  />
                  <Line type="monotone" dataKey="balanceAccumulated" name="Balance acumulado" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                <Wallet className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">No hay datos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tablas: Últimos gastos e ingresos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Últimos gastos</CardTitle>
              <CardDescription>Los 8 gastos más recientes del período</CardDescription>
            </div>
            <button
              type="button"
              onClick={() => navigate("/app/finance")}
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver Finanzas →
            </button>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <p className="text-muted-foreground py-4">Cargando…</p>
            ) : data?.recentExpenses && data.recentExpenses.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Inversor</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentExpenses.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                          {formatShortDate(g.expense_date)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium">{getExpenseTypeLabel(g.expense_type)}</span>
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-sm">{g.description || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{g.inversor_name || "—"}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">{formatCLP(g.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No hay gastos en el período</p>
                <button type="button" onClick={() => navigate("/app/finance")} className="text-sm text-primary mt-2 hover:underline">
                  Ir a Finanzas
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-muted/30 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Últimos ingresos</CardTitle>
              <CardDescription>Los 8 ingresos más recientes del período</CardDescription>
            </div>
            <button
              type="button"
              onClick={() => navigate("/app/finance")}
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver Finanzas →
            </button>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <p className="text-muted-foreground py-4">Cargando…</p>
            ) : data?.recentIncome && data.recentIncome.length > 0 ? (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Fecha</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentIncome.map((item, i) => (
                      <TableRow key={`${item.date}-${item.source}-${i}`}>
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                          {formatShortDate(item.date)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium">{item.source === "sale" ? "Venta" : "Otro"}</span>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">{item.description}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">{formatCLP(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No hay ingresos en el período</p>
                <button type="button" onClick={() => navigate("/app/finance")} className="text-sm text-primary mt-2 hover:underline">
                  Ir a Finanzas
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen ventas y por qué es útil */}
      <Card className="border-0 shadow-sm bg-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Resumen de ventas en el período
          </CardTitle>
          <CardDescription>
            Cantidad de ventas e ingresos por ventas (facturación) vs ganancia (margen) que entra a la empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm font-medium text-muted-foreground">Ventas (unidades)</p>
                <p className="text-2xl font-bold">{data?.salesCount ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Vehículos vendidos con pago realizado</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm font-medium text-muted-foreground">Facturación (precio venta)</p>
                <p className="text-2xl font-bold">{formatCLP(data?.salesRevenue ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Suma de precios de venta</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm font-medium text-muted-foreground">Ganancia por ventas</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCLP(data?.incomeFromSales ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Margen total (lo que suma a ingresos)</p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm font-medium text-muted-foreground">Otros ingresos</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCLP(data?.incomeFromOther ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Comisión crédito, etc.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Por qué es una buena herramienta para Skalemotors */}
      <Card className="border border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">¿Por qué es importante el Seguimiento Financiero en Skalemotors?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc list-inside space-y-2">
            <li><strong className="text-foreground">Visibilidad en tiempo real:</strong> Ves ingresos, gastos y balance sin abrir Excel ni sumar planillas. Todo sale de ventas y de la sección Finanzas.</li>
            <li><strong className="text-foreground">Decisiones con datos:</strong> Saber si un mes fue positivo o negativo y cómo evoluciona el flujo de caja te ayuda a planificar compra de stock, gastos y devoluciones a inversores.</li>
            <li><strong className="text-foreground">Control de gastos:</strong> Al contrastar ingresos vs gastos por mes, detectas picos de gasto y puedes recortar o reprogramar.</li>
            <li><strong className="text-foreground">Un solo lugar:</strong> Ventas (ganancia), ingresos empresa y gastos ya están en el sistema; esta pantalla los une para el seguimiento.</li>
          </ul>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">Error al cargar los datos. Revisa la consola o vuelve a intentar.</p>
      )}
    </div>
  );
}
