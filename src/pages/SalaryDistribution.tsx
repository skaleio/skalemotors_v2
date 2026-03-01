import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useBalanceByMonth } from "@/hooks/useBalanceByMonth";
import { salaryDistributionService, type StoredData } from "@/lib/services/salaryDistribution";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Calendar, DollarSign, PieChart, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const DISTRIBUTION = {
  Mike: 0.3,
  Jota: 0.3,
  "Ahorro Empresa": 0.2,
  Antonio: 0.15,
  Ronaldo: 0.05,
} as const;

const BENEFICIARIOS = Object.keys(DISTRIBUTION) as (keyof typeof DISTRIBUTION)[];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const STORAGE_KEY = "skalemotors_salary_distribution";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function computeAmounts(profit: number): Record<string, number> {
  const amounts: Record<string, number> = {};
  for (const [name, pct] of Object.entries(DISTRIBUTION)) {
    amounts[name] = Math.round(profit * pct);
  }
  return amounts;
}

export default function SalaryDistribution() {
  const { user } = useAuth();
  const branchId = user?.branch_id ?? null;
  const queryClient = useQueryClient();
  const { data: dataFromDb = {}, isLoading: dataLoading } = useQuery({
    queryKey: ["salary-distribution", branchId],
    queryFn: () => salaryDistributionService.getByBranch(branchId ?? ""),
    enabled: Boolean(branchId),
  });
  const [data, setData] = useState<StoredData>(dataFromDb);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMonth, setDialogMonth] = useState<{ year: number; month: number } | null>(null);
  const [profitInput, setProfitInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: balanceByMonth = {}, isLoading: balanceLoading } = useBalanceByMonth(branchId, selectedYear);

  useEffect(() => {
    setData(dataFromDb);
  }, [dataFromDb]);

  const persist = useCallback(
    (next: StoredData) => {
      setData(next);
      if (!branchId) return;
      queryClient.setQueryData(["salary-distribution", branchId], next);
    },
    [branchId, queryClient]
  );

  const yearMonthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

  const openMonthDialog = (year: number, month: number) => {
    const key = yearMonthKey(year, month);
    const existing = data[key];
    const balanceMonth = balanceByMonth[key];
    setDialogMonth({ year, month });
    if (existing) {
      setProfitInput(String(existing.profit));
    } else if (balanceMonth != null) {
      setProfitInput(String(Math.round(balanceMonth.balance)));
    } else {
      setProfitInput("");
    }
    setDialogOpen(true);
  };

  const saveMonth = async () => {
    if (!dialogMonth || !branchId) return;
    const profit = Number(profitInput) || 0;
    const key = yearMonthKey(dialogMonth.year, dialogMonth.month);
    const amounts = computeAmounts(profit);
    setSaving(true);
    try {
      await salaryDistributionService.upsertMonth(
        branchId,
        dialogMonth.year,
        dialogMonth.month,
        profit,
        amounts
      );
      const next = { ...data, [key]: { profit, amounts } };
      persist(next);
      setDialogOpen(false);
      setDialogMonth(null);
    } catch (e) {
      console.error("Error saving salary distribution:", e);
    } finally {
      setSaving(false);
    }
  };

  const totalsByBeneficiary = useCallback(() => {
    const totals: Record<string, number> = {};
    BENEFICIARIOS.forEach((b) => (totals[b] = 0));
    const filterYear = selectedYear;
    const filterMonth = selectedMonthFilter === "all" ? null : Number(selectedMonthFilter);
    Object.entries(data).forEach(([key, monthData]) => {
      const [y, m] = key.split("-").map(Number);
      if (y !== filterYear) return;
      if (filterMonth != null && m !== filterMonth) return;
      Object.entries(monthData.amounts).forEach(([name, amount]) => {
        totals[name] = (totals[name] ?? 0) + amount;
      });
    });
    return totals;
  }, [data, selectedYear, selectedMonthFilter]);

  const yearsWithData = useCallback(() => {
    const years = new Set<number>();
    Object.keys(data).forEach((key) => {
      const y = parseInt(key.split("-")[0], 10);
      if (!isNaN(y)) years.add(y);
    });
    const currentYear = new Date().getFullYear();
    if (!years.has(currentYear)) years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [data]);

  const totals = totalsByBeneficiary();
  const totalProfit = Object.values(totals).reduce((a, b) => a + b, 0);

  const balanceForDialog =
    dialogMonth != null ? balanceByMonth[yearMonthKey(dialogMonth.year, dialogMonth.month)] : null;

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <PieChart className="h-8 w-8" />
          Distribución de salarios
        </h1>
        <p className="text-muted-foreground mt-1">
          Ingresan el monto a repartir por mes; al aceptar se distribuye según los porcentajes: 30% Mike, 30% Jota, 20% Ahorro Empresa, 15% Antonio, 5% Ronaldo.
        </p>
        {!branchId && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            Debes tener una sucursal asignada para ver y guardar la distribución.
          </p>
        )}
      </div>

      {/* Dashboard: totales por persona + filtro por mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Resumen por beneficiario
          </CardTitle>
          <CardDescription>
            Total recibido según el período seleccionado. Usa el año y el mes para filtrar.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Año</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearsWithData().map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Mes</Label>
              <Select
                value={selectedMonthFilter}
                onValueChange={setSelectedMonthFilter}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {MESES.map((nombre, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {BENEFICIARIOS.map((name) => (
              <Card key={name} className="bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {name === "Ahorro Empresa" ? (
                      <Building2 className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    {name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">
                    {formatCurrency(totals[name] ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {DISTRIBUTION[name as keyof typeof DISTRIBUTION] * 100}%
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total período</span>
            <span className="text-xl font-bold tabular-nums">{formatCurrency(totalProfit)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Selector de mes: año + 12 recuadros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cierre por mes
          </CardTitle>
          <CardDescription>
            Clic en un mes para ver el balance, revisar el reparto y aceptar. Los totales se actualizan en los cuadros de arriba.
          </CardDescription>
          <div className="flex items-center gap-2 pt-2">
            <Label className="text-sm font-medium">Año</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearsWithData().map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {MESES.map((nombre, index) => {
              const month = index + 1;
              const key = yearMonthKey(selectedYear, month);
              const monthData = data[key];
              const hasData = monthData && monthData.profit > 0;
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => openMonthDialog(selectedYear, month)}
                  className={`
                    flex flex-col items-center justify-center p-4 rounded-xl border-2 text-left
                    transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                    ${hasData
                      ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/30 dark:border-emerald-500/30"
                      : "border-border bg-card hover:border-primary/30"
                    }
                  `}
                >
                  <span className="font-semibold text-sm text-foreground">{nombre}</span>
                  {hasData ? (
                    <span className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {formatCurrency(monthData.profit)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground mt-1">Sin datos</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Diálogo: ingresar profit del mes */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMonth
                ? `Profit cierre — ${MESES[dialogMonth.month - 1]} ${dialogMonth.year}`
                : "Profit de cierre"}
            </DialogTitle>
            <DialogDescription>
              Revisa el monto y el reparto. Al aceptar, se guarda y los cuadros de arriba se actualizan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {balanceForDialog != null && (
              <p className="text-sm text-muted-foreground">
                Balance del mes (Gastos/Ingresos): <span className="font-medium text-foreground tabular-nums">{formatCurrency(balanceForDialog.balance)}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="profit">Monto a repartir (CLP)</Label>
              <Input
                id="profit"
                type="number"
                min={0}
                step={1}
                placeholder="Ej: 5000000"
                value={profitInput}
                onChange={(e) => setProfitInput(e.target.value)}
              />
            </div>
            {profitInput !== "" && !Number.isNaN(Number(profitInput)) && Number(profitInput) > 0 && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium">Reparto (al aceptar se guarda en los cuadros):</p>
                <ul className="space-y-1 text-sm">
                  {BENEFICIARIOS.map((name) => (
                    <li key={name} className="flex justify-between tabular-nums">
                      <span>{name}</span>
                      <span>{formatCurrency(computeAmounts(Number(profitInput))[name])}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 rounded-md border border-input bg-background hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveMonth}
              disabled={saving || !profitInput.trim()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Aceptar y distribuir"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
