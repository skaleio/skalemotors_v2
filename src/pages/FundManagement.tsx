import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUi } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useFundManagement } from "@/hooks/useFundManagement";
import type { SeriePorDia, SeriePorMes } from "@/hooks/useFundManagement";
import { supabase } from "@/lib/supabase";
import {
  BarChart3,
  Building2,
  Calendar,
  CalendarRange,
  DollarSign,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(value);
}

type ChartView = "day" | "month";

const CONSIGNACION_STATUS: Record<string, { label: string; className: string }> = {
  nuevo: { label: "Nuevo", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
  en_revision: { label: "En revisión", className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800" },
  en_venta: { label: "En venta", className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800" },
  negociando: { label: "Negociando", className: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800" },
  vendido: { label: "Vendido", className: "bg-muted text-muted-foreground border-border" },
  devuelto: { label: "Devuelto", className: "bg-muted text-muted-foreground border-border" },
};

function getConsignacionStatusDisplay(status: string) {
  const key = (status || "").toLowerCase().replace(/\s/g, "_");
  return CONSIGNACION_STATUS[key] ?? { label: status || "—", className: "bg-muted text-muted-foreground border-border" };
}

type DetailModalKey = "hessen" | "miami" | "comprados" | "consignados" | "stock" | null;

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const CHART_COLORS = {
  consignaciones: "hsl(221, 83%, 53%)",
  ventas: "hsl(160, 84%, 39%)",
  facturacion: "hsl(38, 92%, 50%)",
  facturacionFill: "hsl(38, 92%, 50%, 0.12)",
};

function ChartTooltip(
  props: {
    active?: boolean;
    payload?: { name: string; value: number; color: string }[];
    label?: string;
  } & { isMonth?: boolean }
) {
  const { active, payload, label, isMonth } = props;
  if (!active || !payload?.length) return null;
  const title = isMonth
    ? label
    : (payload[0]?.payload?.date
        ? new Date(payload[0].payload.date + "T12:00:00").toLocaleDateString("es-CL", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : label);
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">{entry.name}</span>
            <span className="text-sm font-semibold tabular-nums">
              {entry.name === "Facturación" ? formatCurrency(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function filterSeriesByDateRange<T extends { date?: string; monthKey?: string }>(
  series: T[],
  range: DateRange | undefined
): T[] {
  if (!range?.from) return series;
  const fromStr = range.from.toISOString().slice(0, 10);
  const toStr = range.to ? range.to.toISOString().slice(0, 10) : fromStr;
  const fromMonth = fromStr.slice(0, 7);
  const toMonth = toStr.slice(0, 7);
  return series.filter((item) => {
    if ("date" in item && item.date) {
      return item.date >= fromStr && item.date <= toStr;
    }
    if ("monthKey" in item && item.monthKey) {
      return item.monthKey >= fromMonth && item.monthKey <= toMonth;
    }
    return true;
  });
}

export default function FundManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: fundData, isLoading: fundLoading } = useFundManagement(user?.branch_id ?? null);
  const [chartView, setChartView] = useState<ChartView>("day");
  const [chartDateRange, setChartDateRange] = useState<DateRange | undefined>(undefined);
  const [detailModal, setDetailModal] = useState<DetailModalKey>(null);

  const chartPorDia = (() => {
    const raw = fundData?.charts?.porDia ?? [];
    return filterSeriesByDateRange(raw as SeriePorDia[], chartDateRange);
  })();
  const chartPorMes = (() => {
    const raw = fundData?.charts?.porMes ?? [];
    return filterSeriesByDateRange(raw as SeriePorMes[], chartDateRange);
  })();

  // Sincronización con Supabase: cuando se agrega, actualiza o elimina una venta, refrescar Ventas Hessen / Miami
  useEffect(() => {
    const channel = supabase
      .channel("fund-management-sales-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["fund-management"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-8 w-8" />
          Gestión de Fondos
        </h1>
        <p className="text-muted-foreground mt-2">
          Herramienta independiente: resumen por automotora, métricas de dinero y rendimiento
        </p>
      </div>

      {/* Consignaciones diarias, ventas diarias y gráfico por día/mes */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900/50 dark:to-blue-950/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Consignaciones y ventas
          </CardTitle>
          <CardDescription>
            Consignaciones diarias, ventas diarias y evolución por día o por mes
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {fundLoading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando…</div>
          ) : fundData?.charts ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Consignaciones hoy
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{fundData.charts?.consignacionesHoy ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ingresadas hoy</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Ventas hoy</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fundData.charts?.ventasHoy ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Unidades vendidas hoy</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Facturación hoy</p>
                  <p className="text-2xl font-bold">{formatCurrency(fundData.charts?.facturacionHoy ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ingreso bruto hoy</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm font-medium text-muted-foreground">Vista del gráfico</span>
                <div className="flex items-center gap-2">
                  <Tabs value={chartView} onValueChange={(v) => setChartView(v as ChartView)}>
                    <TabsList className="h-9 bg-muted/50">
                      <TabsTrigger value="day" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        Por día
                      </TabsTrigger>
                      <TabsTrigger value="month" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        Por mes
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        aria-label="Filtrar por rango de fechas"
                      >
                        <CalendarRange className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarUi
                        mode="range"
                        selected={chartDateRange}
                        onSelect={setChartDateRange}
                        numberOfMonths={2}
                        locale={undefined}
                      />
                      {chartDateRange?.from && (
                        <div className="p-2 border-t flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {chartDateRange.to
                              ? `${chartDateRange.from.toLocaleDateString("es-CL")} – ${chartDateRange.to.toLocaleDateString("es-CL")}`
                              : chartDateRange.from.toLocaleDateString("es-CL")}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setChartDateRange(undefined)}
                          >
                            Limpiar
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 shadow-inner">
                <div className="h-[360px] w-full">
                  {chartView === "day" ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartPorDia}
                        margin={{ top: 16, right: 24, left: 8, bottom: 16 }}
                        barCategoryGap="12%"
                        barGap={6}
                      >
                        <defs>
                          <linearGradient id="areaFacturacionDay" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.facturacion} stopOpacity={0.25} />
                            <stop offset="100%" stopColor={CHART_COLORS.facturacion} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.6} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={28}
                          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                          tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
                        />
                        <Tooltip
                          content={(p) => <ChartTooltip {...p} isMonth={false} />}
                          cursor={{ fill: "hsl(var(--muted))", opacity: 0.15 }}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: "12px" }}
                          formatter={(value) => <span className="text-sm font-medium text-foreground">{value}</span>}
                          iconType="circle"
                          iconSize={10}
                          align="center"
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="facturacion"
                          name="Facturación"
                          stroke={CHART_COLORS.facturacion}
                          strokeWidth={2}
                          fill="url(#areaFacturacionDay)"
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="consignaciones"
                          name="Consignaciones"
                          fill={CHART_COLORS.consignaciones}
                          radius={[6, 6, 0, 0]}
                          barSize={22}
                          maxBarSize={28}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="ventas"
                          name="Ventas"
                          fill={CHART_COLORS.ventas}
                          radius={[6, 6, 0, 0]}
                          barSize={22}
                          maxBarSize={28}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartPorMes}
                        margin={{ top: 16, right: 24, left: 8, bottom: 16 }}
                        barCategoryGap="20%"
                        barGap={8}
                      >
                        <defs>
                          <linearGradient id="areaFacturacionMonth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.facturacion} stopOpacity={0.25} />
                            <stop offset="100%" stopColor={CHART_COLORS.facturacion} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.6} />
                        <XAxis
                          dataKey="monthLabel"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={28}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                          tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
                        />
                        <Tooltip
                          content={(p) => <ChartTooltip {...p} isMonth />}
                          cursor={{ fill: "hsl(var(--muted))", opacity: 0.15 }}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: "12px" }}
                          formatter={(value) => <span className="text-sm font-medium text-foreground">{value}</span>}
                          iconType="circle"
                          iconSize={10}
                          align="center"
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="facturacion"
                          name="Facturación"
                          stroke={CHART_COLORS.facturacion}
                          strokeWidth={2}
                          fill="url(#areaFacturacionMonth)"
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="consignaciones"
                          name="Consignaciones"
                          fill={CHART_COLORS.consignaciones}
                          radius={[6, 6, 0, 0]}
                          barSize={28}
                          maxBarSize={36}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="ventas"
                          name="Ventas"
                          fill={CHART_COLORS.ventas}
                          radius={[6, 6, 0, 0]}
                          barSize={28}
                          maxBarSize={36}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Sin datos para el gráfico</div>
          )}
        </CardContent>
      </Card>

      {/* Bloque: Gestión Hessen Motors */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-violet-50/30 dark:from-slate-900/50 dark:to-violet-950/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-600" />
            Gestión Hessen Motors
          </CardTitle>
          <CardDescription>
            Ventas propias, socios Miami Motors, stock comprado vs consignado y disponible
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {fundLoading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando…</div>
          ) : fundData ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <button
                  type="button"
                  onClick={() => setDetailModal("hessen")}
                  className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50 hover:border-violet-200 dark:hover:border-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:ring-offset-2 cursor-pointer"
                >
                  <p className="text-sm font-medium text-muted-foreground">Ventas Hessen Motors</p>
                  <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">{fundData.hessen?.hessenSalesUnits ?? 0} unid.</p>
                  <p className="text-xs text-muted-foreground mt-1">Ganancias: {formatCurrency(fundData.hessen?.hessenSalesProfit ?? 0)}</p>
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 opacity-80">Ver listado →</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModal("miami")}
                  className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50 hover:border-sky-200 dark:hover:border-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:ring-offset-2 cursor-pointer"
                >
                  <p className="text-sm font-medium text-muted-foreground">Ventas Miami Motors</p>
                  <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{fundData.hessen?.miamiSalesUnits ?? 0} unid.</p>
                  <p className="text-xs text-muted-foreground mt-1">Participación: {formatCurrency(fundData.hessen?.miamiParticipation ?? 0)}</p>
                  <p className="text-xs text-sky-600 dark:text-sky-400 mt-1 opacity-80">Ver listado →</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModal("comprados")}
                  className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50 hover:border-border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                >
                  <p className="text-sm font-medium text-muted-foreground">Autos comprados</p>
                  <p className="text-2xl font-bold">{fundData.hessen?.vehiclesPurchasedCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Contrapuesto a consignados</p>
                  <p className="text-xs text-muted-foreground mt-1 opacity-80">Ver listado →</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModal("consignados")}
                  className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50 hover:border-border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                >
                  <p className="text-sm font-medium text-muted-foreground">Consignados</p>
                  <p className="text-2xl font-bold">{fundData.hessen?.consignadosCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Listado actual</p>
                  <p className="text-xs text-muted-foreground mt-1 opacity-80">Ver listado →</p>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModal("stock")}
                  className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50 hover:border-emerald-200 dark:hover:border-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-2 cursor-pointer"
                >
                  <p className="text-sm font-medium text-muted-foreground">No vendidos (stock)</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fundData.hessen?.stockAvailableCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Disponible hoy</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 opacity-80">Ver listado →</p>
                </button>
              </div>
              {((fundData.hessen?.consignadosList ?? []).length > 0 || (fundData.hessen?.stockAvailableList ?? []).length > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(fundData.hessen?.consignadosList ?? []).length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                      <p className="text-sm font-semibold text-foreground mb-3">Listado consignados</p>
                      <ul className="space-y-0 max-h-36 overflow-auto pr-1">
                        {(fundData.hessen?.consignadosList ?? []).slice(0, 15).map((c) => {
                          const statusDisplay = getConsignacionStatusDisplay(c.status);
                          return (
                            <li
                              key={c.id}
                              className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0"
                            >
                              <span className="text-sm text-foreground truncate min-w-0">{c.label}</span>
                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusDisplay.className}`}
                              >
                                {statusDisplay.label}
                              </span>
                            </li>
                          );
                        })}
                        {(fundData.hessen?.consignadosList ?? []).length > 15 && (
                          <li className="py-2 text-xs text-muted-foreground">
                            + {(fundData.hessen?.consignadosList ?? []).length - 15} más
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  {(fundData.hessen?.stockAvailableList ?? []).length > 0 && (
                    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                      <p className="text-sm font-semibold text-foreground mb-3">Stock disponible (primeros)</p>
                      <ul className="space-y-0 max-h-36 overflow-auto pr-1">
                        {(fundData.hessen?.stockAvailableList ?? []).slice(0, 15).map((v) => (
                          <li
                            key={v.id}
                            className="py-2 border-b border-border/40 last:border-0 text-sm text-foreground"
                          >
                            {v.make} {v.model} {v.year}
                          </li>
                        ))}
                        {(fundData.hessen?.stockAvailableList ?? []).length > 15 && (
                          <li className="py-2 text-xs text-muted-foreground">
                            + {(fundData.hessen?.stockAvailableList ?? []).length - 15} más
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Sin datos de gestión</div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalle al hacer clic en una tarjeta */}
      <Dialog open={detailModal !== null} onOpenChange={(open) => !open && setDetailModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {detailModal === "hessen" && "Ventas Hessen Motors"}
              {detailModal === "miami" && "Ventas Miami Motors"}
              {detailModal === "comprados" && "Autos comprados"}
              {detailModal === "consignados" && "Consignados"}
              {detailModal === "stock" && "Stock disponible (no vendidos)"}
            </DialogTitle>
            <DialogDescription>
              {detailModal === "hessen" && "Listado de ventas propias con fecha, vehículo, ganancia y precio."}
              {detailModal === "miami" && "Listado de ventas Miami Motors con participación."}
              {detailModal === "comprados" && "Vehículos comprados (no consignados)."}
              {detailModal === "consignados" && "Vehículos en consignación activa."}
              {detailModal === "stock" && "Vehículos disponibles en stock hoy."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0 -mx-6 px-6">
            {fundData && detailModal === "hessen" && (() => {
              const list = fundData.hessen?.hessenSalesList ?? [];
              return list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No hay ventas Hessen Motors.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead className="text-right">Precio venta</TableHead>
                      <TableHead className="text-right">Ganancia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(s.sale_date)}</TableCell>
                        <TableCell className="font-medium">{s.label}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.sale_price)}</TableCell>
                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(s.margin)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
            {fundData && detailModal === "miami" && (() => {
              const list = fundData.hessen?.miamiSalesList ?? [];
              return list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No hay ventas Miami Motors.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead className="text-right">Precio venta</TableHead>
                      <TableHead className="text-right">Participación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(s.sale_date)}</TableCell>
                        <TableCell className="font-medium">{s.label}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.sale_price)}</TableCell>
                        <TableCell className="text-right text-sky-600 dark:text-sky-400">{formatCurrency(s.margin)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
            {fundData && detailModal === "comprados" && (() => {
              const list = fundData.hessen?.vehiclesPurchasedList ?? [];
              return list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No hay autos comprados.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Año</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.make}</TableCell>
                        <TableCell>{v.model}</TableCell>
                        <TableCell>{v.year}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{v.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
            {fundData && detailModal === "consignados" && (() => {
              const list = fundData.hessen?.consignadosList ?? [];
              return list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No hay consignados activos.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((c) => {
                    const statusDisplay = getConsignacionStatusDisplay(c.status);
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                        <span className="font-medium">{c.label}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusDisplay.className}`}>
                          {statusDisplay.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            {fundData && detailModal === "stock" && (() => {
              const list = fundData.hessen?.stockAvailableList ?? [];
              return list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No hay stock disponible.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Año</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.make}</TableCell>
                        <TableCell>{v.model}</TableCell>
                        <TableCell>{v.year}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bloque: Métricas de Dinero */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-emerald-50/30 dark:from-slate-900/50 dark:to-emerald-950/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Métricas de Dinero
          </CardTitle>
          <CardDescription>
            Facturación, ganancias reales y pendientes, crédito y costos de preparación
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {fundLoading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando…</div>
          ) : fundData ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Facturaciones</p>
                  <p className="text-xl font-bold">{formatCurrency(fundData.money?.facturaciones ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ingreso total bruto</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Ganancias reales</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(fundData.money?.gananciasReales ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Lo que ya entró a caja</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Ganancias pendientes</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(fundData.money?.gananciasPendientes ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Por cobrar</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Ganancias por crédito</p>
                  <p className="text-xl font-bold">{formatCurrency(fundData.money?.gananciasPorCredito ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Margen financieras</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Costo prep./limpieza</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(fundData.money?.costoPreparacionLimpieza ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Gasto acumulado</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Invertido (Jota, Mike, Ronald)</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(fundData.money?.invertidoJotaMikeRonald ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total invertido por socios</p>
                </div>
              </div>
              {(fundData.money?.rankingMarcas ?? []).length > 0 && (
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium mb-2">Ranking marcas más rentables (por modelo)</p>
                  <div className="overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Marca</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead className="text-right">Unidades</TableHead>
                          <TableHead className="text-right">Margen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(fundData.money?.rankingMarcas ?? []).map((r, i) => (
                          <TableRow key={`${r.make}-${r.model}-${i}`}>
                            <TableCell className="font-medium">{r.make}</TableCell>
                            <TableCell>{r.model}</TableCell>
                            <TableCell className="text-right">{r.units}</TableCell>
                            <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(r.margin)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Sin datos de métricas</div>
          )}
        </CardContent>
      </Card>

      {/* Bloque: Rendimiento y Clientes */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-amber-50/30 dark:from-slate-900/50 dark:to-amber-950/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-600" />
            Rendimiento y Clientes
          </CardTitle>
          <CardDescription>
            Volumen de ventas, modelos estrella, días en stock, origen de leads y conversión
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {fundLoading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando…</div>
          ) : fundData ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Autos vendidos</p>
                  <p className="text-2xl font-bold">{fundData.performance?.totalVendidos ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Volumen total</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Lead time (días en stock)</p>
                  <p className="text-2xl font-bold">{fundData.performance?.leadTimeDias != null ? `${fundData.performance.leadTimeDias} días` : "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Promedio de rotación</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Conversión crédito / contado</p>
                  <p className="text-lg font-bold">Crédito: {(fundData.performance?.conversionCredito ?? 0).toFixed(0)}% · Contado: {(fundData.performance?.conversionContado ?? 0).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{fundData.performance?.totalConCredito ?? 0} crédito · {fundData.performance?.totalContado ?? 0} contado</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Retorno / Referidos</p>
                  <p className="text-2xl font-bold">{fundData.performance?.referidosVendidos ?? 0} / {fundData.performance?.referidosTotal ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Tasa: {(fundData.performance?.tasaRetornoPercent ?? 0).toFixed(1)}%</p>
                </div>
              </div>
              {((fundData.performance?.topModelos ?? []).length > 0 || (fundData.performance?.origenLeads ?? []).length > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {(fundData.performance?.topModelos ?? []).length > 0 && (
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium mb-2">Autos más vendidos</p>
                      <ul className="text-sm space-y-1">
                        {(fundData.performance?.topModelos ?? []).slice(0, 8).map((m, i) => (
                          <li key={`${m.make}-${m.model}-${i}`} className="flex justify-between">
                            <span>{m.make} {m.model}</span>
                            <span className="font-medium">{m.count} ventas</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(fundData.performance?.origenLeads ?? []).length > 0 && (
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Origen de los leads (vendidos)
                      </p>
                      <ul className="text-sm space-y-1">
                        {(fundData.performance?.origenLeads ?? []).map((o) => (
                          <li key={o.source} className="flex justify-between">
                            <span className="capitalize">{o.source}</span>
                            <span className="font-medium">{o.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Sin datos de rendimiento</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
