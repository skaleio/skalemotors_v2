import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/ui/kpi-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { formatCLP } from "@/lib/format";
import { CHART_PALETTE, CHART_PRIMARY, CHART_TOOLTIP_PROPS } from "@/lib/chartPalette";
import type { DateRangePreset } from "@/hooks/useFinancialTracking";
import { useFinancialTracking } from "@/hooks/useFinancialTracking";
import {
  BarChart3,
  Calendar,
  DollarSign,
  Info,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  Car,
  Receipt,
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

function formatShortDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

/** Header de Card consistente: ícono muted + título + tooltip de ayuda + action opcional. */
function SectionHeader({ icon: Icon, title, help, description, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  help?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader className="border-b">
      <div className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            {title}
            {help ? (
              <TooltipProvider delayDuration={150}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help" aria-label="Información">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{help}</TooltipContent>
                </UITooltip>
              </TooltipProvider>
            ) : null}
          </CardTitle>
          {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
        </div>
        {action}
      </div>
    </CardHeader>
  );
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

  const showSkeleton = isLoading && !data;
  const balanceTone: "default" | "positive" | "negative" =
    (data?.balance ?? 0) > 0 ? "positive" : (data?.balance ?? 0) < 0 ? "negative" : "default";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Seguimiento financiero</h1>
          <p className="text-muted-foreground mt-2">
            Salud financiera de tu automotora — ventas, ingresos y gastos en un solo lugar.
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
        <KPICard
          label="Ingresos totales"
          icon={TrendingUp}
          loading={showSkeleton}
          loadingWidth="lg"
          value={data ? formatCLP(data.totalIncome ?? 0) : ""}
          valueTone="positive"
          subtitle={data ? `${data.salesCount} venta(s) · ${formatCLP(data.incomeFromSales)} ganancia` : "En el período seleccionado"}
          info="Ganancia de ventas (margen con pago realizado) + otros ingresos (ej. comisión crédito). Cuánto entra realmente a la empresa en el período."
        />
        <KPICard
          label="Gastos totales"
          icon={TrendingDown}
          loading={showSkeleton}
          loadingWidth="lg"
          value={data ? formatCLP(data.totalExpenses ?? 0) : ""}
          valueTone="negative"
          subtitle="En el período seleccionado"
          info="Total de gastos registrados en Finanzas (operación, marketing, servicios, etc.). Para no gastar más de lo que entra y planificar devoluciones a inversores."
        />
        <KPICard
          label="Utilidad neta"
          icon={Wallet}
          loading={showSkeleton}
          loadingWidth="lg"
          value={data ? formatCLP(data.balance ?? 0) : ""}
          valueTone={balanceTone}
          subtitle="Ingresos − gastos"
          info="Resultado real del período. Positivo = ganancia; negativo = ajustar gastos o aumentar ventas."
        />
        <KPICard
          label="Margen de ganancia"
          icon={BarChart3}
          loading={showSkeleton}
          loadingWidth="sm"
          value={data ? `${data.marginPercent ?? 0}%` : ""}
          subtitle="Sobre ingresos del período"
          info="Porcentaje de utilidad sobre ingresos. Un margen sano indica que los costos están controlados."
        />
      </div>

      {/* Charts fila 1: Ingresos vs Gastos, Flujo de caja */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader
            icon={BarChart3}
            title="Ingresos vs gastos"
            description="Por mes en el período seleccionado"
            help="Comparación mensual. Ves cuándo entró más dinero y cuándo los gastos se dispararon."
          />
          <CardContent className="pt-6">
            {showSkeleton ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.byMonth && data.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.byMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    {...CHART_TOOLTIP_PROPS}
                    formatter={(value: number) => [formatCLP(value), ""]}
                    labelFormatter={(label) => label}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8 }} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                  <Bar dataKey="income" name="Ingresos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="expenses" name="Gastos" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <Receipt className="h-10 w-10 mb-3 text-muted-foreground/40" />
                <p className="text-sm">No hay datos en este período</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader
            icon={DollarSign}
            title="Flujo de caja"
            description="Balance neto por mes (ingresos − gastos)"
            help="Línea ascendente = meses positivos; si baja, ese mes gastaste más de lo que entró."
          />
          <CardContent className="pt-6">
            {showSkeleton ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.byMonth && data.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.byMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(value: number) => [formatCLP(value), "Balance"]} labelFormatter={(label) => label} />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name="Balance"
                    stroke={CHART_PRIMARY}
                    strokeWidth={2}
                    dot={{ fill: CHART_PRIMARY, r: 3, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <DollarSign className="h-10 w-10 mb-3 text-muted-foreground/40" />
                <p className="text-sm">No hay datos en este período</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts fila 2: Tendencia ventas, Gastos por categoría, Gastos por inversor */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionHeader
            icon={Car}
            title="Tendencia de ventas"
            description="Unidades y monto por mes"
            help="Unidades vendidas y facturación por mes. Sirve para ver temporadas y metas."
          />
          <CardContent className="pt-6">
            {showSkeleton ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.byMonth && data.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.byMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip
                    {...CHART_TOOLTIP_PROPS}
                    formatter={(value: number, name: string) => [name === "Ventas (unid.)" ? value : formatCLP(value), name]}
                    labelFormatter={(label) => label}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8 }} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                  <Bar yAxisId="left" dataKey="salesCount" name="Ventas (unid.)" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar yAxisId="right" dataKey="salesRevenue" name="Facturación" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                <Car className="h-9 w-9 mb-2 text-muted-foreground/40" />
                <p className="text-sm">No hay datos</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader
            icon={Receipt}
            title="Gastos por categoría"
            description="En el período seleccionado"
            help="Distribución de gastos por tipo (operación, marketing, servicios, etc.)."
          />
          <CardContent className="pt-6">
            {showSkeleton ? (
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
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v: number) => [formatCLP(v), ""]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                <Receipt className="h-9 w-9 mb-2 text-muted-foreground/40" />
                <p className="text-sm">No hay gastos</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader
            icon={User}
            title="Gastos por inversor"
            description="Monto por inversor"
            help="Quién pagó qué en el período. Útil para repartir devoluciones."
          />
          <CardContent className="pt-6">
            {showSkeleton ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.expensesByInversor && data.expensesByInversor.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.expensesByInversor} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={55} />
                  <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v: number) => [formatCLP(v), "Gasto"]} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                  <Bar dataKey="amount" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                <User className="h-9 w-9 mb-2 text-muted-foreground/40" />
                <p className="text-sm">No hay gastos por inversor</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts fila 3: Desglose ingresos, Balance acumulado */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader
            icon={TrendingUp}
            title="Desglose de ingresos"
            description="Ventas vs otros ingresos"
            help="Proporción entre ganancia por ventas y otros ingresos (comisión crédito, etc.)."
          />
          <CardContent className="pt-6">
            {showSkeleton ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data && (data.incomeFromSales > 0 || data.incomeFromOther > 0) ? (
              (() => {
                const incomePieData = [
                  { name: "Ganancia ventas", value: data.incomeFromSales },
                  { name: "Otros ingresos", value: data.incomeFromOther },
                ].filter((d) => d.value > 0);
                const incomeColors = ["hsl(var(--chart-2))", CHART_PRIMARY];
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
                          <Cell key={i} fill={incomeColors[i]} stroke="hsl(var(--card))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v: number) => [formatCLP(v), ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="h-9 w-9 mb-2 text-muted-foreground/40" />
                <p className="text-sm">No hay ingresos en el período</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader
            icon={Calendar}
            title="Balance acumulado"
            description="Resultado acumulado por mes"
            help="Suma acumulada mes a mes (ingresos − gastos). Muestra la evolución del resultado en el tiempo."
          />
          <CardContent className="pt-6">
            {showSkeleton ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Cargando…</div>
            ) : data?.byMonth && data.byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.byMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(value: number) => [formatCLP(value), "Acumulado"]} labelFormatter={(label) => label} />
                  <Line
                    type="monotone"
                    dataKey="balanceAccumulated"
                    name="Balance acumulado"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-4))", r: 3, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                <Wallet className="h-9 w-9 mb-2 text-muted-foreground/40" />
                <p className="text-sm">No hay datos</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tablas: Últimos gastos e ingresos */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader
            icon={Receipt}
            title="Últimos gastos"
            description="Los 8 más recientes del período"
            action={
              <button
                type="button"
                onClick={() => navigate("/app/finance")}
                className="text-xs font-medium text-primary hover:underline shrink-0"
              >
                Ver Finanzas →
              </button>
            }
          />
          <CardContent className="pt-4">
            {showSkeleton ? (
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
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs skale-num">
                          {formatShortDate(g.expense_date)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium">{getExpenseTypeLabel(g.expense_type)}</span>
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate text-sm">{g.description || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{g.inversor_name || "—"}</TableCell>
                        <TableCell className="text-right font-medium text-destructive skale-num">{formatCLP(g.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Receipt className="h-9 w-9 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm">No hay gastos en el período</p>
                <button type="button" onClick={() => navigate("/app/finance")} className="text-sm text-primary mt-2 hover:underline">
                  Ir a Finanzas
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader
            icon={TrendingUp}
            title="Últimos ingresos"
            description="Los 8 más recientes del período"
            action={
              <button
                type="button"
                onClick={() => navigate("/app/finance")}
                className="text-xs font-medium text-primary hover:underline shrink-0"
              >
                Ver Finanzas →
              </button>
            }
          />
          <CardContent className="pt-4">
            {showSkeleton ? (
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
                        <TableCell className="whitespace-nowrap text-muted-foreground text-xs skale-num">
                          {formatShortDate(item.date)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium">{item.source === "sale" ? "Venta" : "Otro"}</span>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">{item.description}</TableCell>
                        <TableCell className="text-right font-medium text-success skale-num">{formatCLP(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <TrendingUp className="h-9 w-9 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm">No hay ingresos en el período</p>
                <button type="button" onClick={() => navigate("/app/finance")} className="text-sm text-primary mt-2 hover:underline">
                  Ir a Finanzas
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen ventas */}
      <Card className="bg-muted/30">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Car className="h-4 w-4 text-muted-foreground" />
            Resumen de ventas en el período
          </CardTitle>
          <CardDescription className="text-xs">
            Cantidad de ventas e ingresos (facturación) vs ganancia (margen) que entra a la empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {showSkeleton ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border bg-card p-4">
                <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">Ventas (unid.)</p>
                <p className="text-2xl font-semibold skale-num mt-2">{data?.salesCount ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Vehículos con pago realizado</p>
              </div>
              <div className="rounded-md border bg-card p-4">
                <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">Facturación</p>
                <p className="text-2xl font-semibold skale-num mt-2">{formatCLP(data?.salesRevenue ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Suma de precios de venta</p>
              </div>
              <div className="rounded-md border bg-card p-4">
                <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">Ganancia ventas</p>
                <p className="text-2xl font-semibold skale-num text-success mt-2">{formatCLP(data?.incomeFromSales ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Margen total</p>
              </div>
              <div className="rounded-md border bg-card p-4">
                <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">Otros ingresos</p>
                <p className="text-2xl font-semibold skale-num text-success mt-2">{formatCLP(data?.incomeFromOther ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Comisión crédito, etc.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive">Error al cargar los datos. Revisá la consola o volvé a intentar.</p>
      )}
    </div>
  );
}
