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
import { Building2, Calendar, DollarSign, Percent, PieChart, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const DISTRIBUTION = {
  Mike: 0.3,
  Jota: 0.3,
  "Ahorro Empresa": 0.2,
  Antonio: 0.15,
  Ronaldo: 0.05,
  Comisiones: 0,
} as const;

const BENEFICIARIOS = Object.keys(DISTRIBUTION) as (keyof typeof DISTRIBUTION)[];

/** Colores por beneficiario para los cuadros. */
const BENEFICIARY_CARD_CLASS: Record<string, string> = {
  Mike: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800",
  Jota: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800",
  "Ahorro Empresa": "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800",
  Antonio: "bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800",
  Ronaldo: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800",
  Comisiones: "bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Detalle de una comisión guardada (monto + nota). */
const COMISIONES_DETALLE_KEY = "ComisionesDetalle";

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
    queryKey: ["salary-distribution", branchId ?? "all"],
    queryFn: () => salaryDistributionService.getByBranch(branchId ?? ""),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const [data, setData] = useState<StoredData>(dataFromDb);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMonth, setDialogMonth] = useState<{ year: number; month: number } | null>(null);
  const [profitInput, setProfitInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [beneficiaryDetailName, setBeneficiaryDetailName] = useState<string | null>(null);
  const [comisionesModalOpen, setComisionesModalOpen] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState("");
  const [commissionNote, setCommissionNote] = useState("");
  const [commissionMonth, setCommissionMonth] = useState(() => new Date().getMonth() + 1);
  const [commissionYear, setCommissionYear] = useState(() => new Date().getFullYear());
  const [moveCommissionEntry, setMoveCommissionEntry] = useState<{ sourceKey: string; entryIndex: number; amount: number; note: string } | null>(null);
  const [moveTargetMonth, setMoveTargetMonth] = useState(1);
  const [moveTargetYear, setMoveTargetYear] = useState(() => new Date().getFullYear());

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
    if (!dialogMonth) return;
    if (!branchId) {
      toast.error("Para guardar la distribución, asigna una sucursal en Configuración.");
      return;
    }
    const profit = Number(profitInput) || 0;
    const key = yearMonthKey(dialogMonth.year, dialogMonth.month);
    const existingAmounts = data[key]?.amounts ?? {};
    const computed = computeAmounts(profit);
    const amounts = {
      ...computed,
      Comisiones: typeof existingAmounts.Comisiones === "number" ? existingAmounts.Comisiones : 0,
      [COMISIONES_DETALLE_KEY]: Array.isArray(existingAmounts[COMISIONES_DETALLE_KEY])
        ? existingAmounts[COMISIONES_DETALLE_KEY]
        : [],
    } as Record<string, number | { amount: number; note: string }[]>;
    setSaving(true);
    try {
      await salaryDistributionService.upsertMonth(
        branchId,
        dialogMonth.year,
        dialogMonth.month,
        profit,
        amounts
      );
      setData((prev) => {
        const next = { ...prev, [key]: { profit, amounts: { ...amounts } } };
        queryClient.setQueryData(["salary-distribution", branchId], next);
        return next;
      });
      setDialogOpen(false);
      setDialogMonth(null);
      toast.success("Reparto guardado. Comisiones del mes se mantuvieron.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo guardar";
      console.error("Error saving salary distribution:", e);
      toast.error(message.includes("does not exist") || message.includes("no existe")
        ? "La tabla de distribución no existe en la base de datos. Ejecuta el SQL de migración en Supabase (SQL Editor)."
        : `No se pudo guardar: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveCommission = async () => {
    if (!branchId) {
      toast.error("Para guardar, asigna una sucursal en Configuración.");
      return;
    }
    const amount = Number(commissionAmount) || 0;
    if (amount <= 0) {
      toast.error("Ingresa un monto mayor a 0.");
      return;
    }
    const key = yearMonthKey(commissionYear, commissionMonth);
    const existing = data[key];
    const existingAmounts = existing?.amounts ?? {};
    const detalle: { amount: number; note: string }[] = Array.isArray(existingAmounts[COMISIONES_DETALLE_KEY])
      ? [...(existingAmounts[COMISIONES_DETALLE_KEY] as { amount: number; note: string }[])]
      : [];
    detalle.push({ amount, note: commissionNote.trim() || "—" });
    const totalComisiones = detalle.reduce((s, e) => s + e.amount, 0);
    const amounts = {
      ...existingAmounts,
      Comisiones: totalComisiones,
      [COMISIONES_DETALLE_KEY]: detalle,
    } as Record<string, number | { amount: number; note: string }[]>;
    const profit = existing?.profit ?? 0;
    setSaving(true);
    try {
      await salaryDistributionService.upsertMonth(branchId, commissionYear, commissionMonth, profit, amounts);
      setData((prev) => {
        const next = { ...prev, [key]: { profit, amounts: { ...amounts } } };
        queryClient.setQueryData(["salary-distribution", branchId], next);
        return next;
      });
      setCommissionAmount("");
      setCommissionNote("");
      toast.success("Comisión agregada.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo guardar";
      console.error("Error saving commission:", e);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const moveCommissionToMonth = async () => {
    if (!branchId || !moveCommissionEntry) return;
    const { sourceKey, entryIndex, amount, note } = moveCommissionEntry;
    const [sourceYear, sourceMonth] = sourceKey.split("-").map(Number);
    const targetKey = yearMonthKey(moveTargetYear, moveTargetMonth);
    if (sourceKey === targetKey) {
      toast.error("El mes de destino debe ser distinto al actual.");
      return;
    }
    const sourceData = data[sourceKey];
    const detalleSource = Array.isArray(sourceData?.amounts[COMISIONES_DETALLE_KEY])
      ? (sourceData!.amounts[COMISIONES_DETALLE_KEY] as { amount: number; note: string }[]).slice()
      : [];
    const entry = detalleSource[entryIndex];
    if (!entry) return;
    detalleSource.splice(entryIndex, 1);
    const newComisionesSource = detalleSource.reduce((s, e) => s + e.amount, 0);
    const amountsSource = {
      ...(sourceData?.amounts ?? {}),
      Comisiones: newComisionesSource,
      [COMISIONES_DETALLE_KEY]: detalleSource,
    } as Record<string, number | { amount: number; note: string }[]>;

    const targetData = data[targetKey];
    const existingAmounts = targetData?.amounts ?? {};
    const detalleTarget = Array.isArray(existingAmounts[COMISIONES_DETALLE_KEY])
      ? [...(existingAmounts[COMISIONES_DETALLE_KEY] as { amount: number; note: string }[])]
      : [];
    detalleTarget.push({ amount: entry.amount, note: entry.note || "—" });
    const newComisionesTarget = detalleTarget.reduce((s, e) => s + e.amount, 0);
    const amountsTarget = {
      ...existingAmounts,
      Comisiones: newComisionesTarget,
      [COMISIONES_DETALLE_KEY]: detalleTarget,
    } as Record<string, number | { amount: number; note: string }[]>;

    setSaving(true);
    try {
      await salaryDistributionService.upsertMonth(branchId, sourceYear, sourceMonth, sourceData?.profit ?? 0, amountsSource);
      await salaryDistributionService.upsertMonth(branchId, moveTargetYear, moveTargetMonth, targetData?.profit ?? 0, amountsTarget);
      setData((prev) => {
        const next = {
          ...prev,
          [sourceKey]: { profit: sourceData?.profit ?? 0, amounts: { ...amountsSource } },
          [targetKey]: { profit: targetData?.profit ?? 0, amounts: { ...amountsTarget } },
        };
        queryClient.setQueryData(["salary-distribution", branchId], next);
        return next;
      });
      setMoveCommissionEntry(null);
      toast.success("Comisión movida al mes seleccionado.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo mover";
      console.error("Error moving commission:", e);
      toast.error(message);
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
      Object.entries(monthData.amounts).forEach(([name, value]) => {
        if (BENEFICIARIOS.includes(name) && typeof value === "number") {
          totals[name] = (totals[name] ?? 0) + value;
        }
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

  const detailEntries = beneficiaryDetailName
    ? (() => {
        const out: { key: string; dateLabel: string; amount: number }[] = [];
        Object.entries(data).forEach(([key, monthData]) => {
          const amount = monthData.amounts[beneficiaryDetailName];
          if (amount != null && amount > 0) {
            const [y, m] = key.split("-").map(Number);
            out.push({
              key,
              dateLabel: `${MESES[m - 1]} ${y}`,
              amount,
            });
          }
        });
        out.sort((a, b) => b.key.localeCompare(a.key));
        return out;
      })()
    : [];

  const detailTotal = detailEntries.reduce((sum, e) => sum + e.amount, 0);

  const comisionesDetalleList: { key: string; sourceKey: string; entryIndex: number; dateLabel: string; amount: number; note: string }[] = [];
  Object.entries(data).forEach(([key, monthData]) => {
    const detalle = monthData.amounts[COMISIONES_DETALLE_KEY];
    if (!Array.isArray(detalle)) return;
    const [y, m] = key.split("-").map(Number);
    const dateLabel = `${MESES[m - 1]} ${y}`;
    (detalle as { amount: number; note: string }[]).forEach((entry, idx) => {
      comisionesDetalleList.push({
        key: `${key}-${idx}`,
        sourceKey: key,
        entryIndex: idx,
        dateLabel,
        amount: entry.amount,
        note: entry.note || "—",
      });
    });
  });
  comisionesDetalleList.sort((a, b) => {
    const [ay, am] = a.key.split("-").slice(0, 2).map(Number);
    const [by, bm] = b.key.split("-").slice(0, 2).map(Number);
    return by !== ay ? by - ay : bm - am;
  });

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {BENEFICIARIOS.map((name) => (
              <Card
                key={name}
                className={`border-2 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${BENEFICIARY_CARD_CLASS[name] ?? "bg-muted/40 border-border"}`}
                onClick={() => (name === "Comisiones" ? setComisionesModalOpen(true) : setBeneficiaryDetailName(name))}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {name === "Ahorro Empresa" ? (
                      <Building2 className="h-4 w-4" />
                    ) : name === "Comisiones" ? (
                      <Percent className="h-4 w-4" />
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
              const hasAmounts = monthData && Object.values(monthData.amounts).some((v) => typeof v === "number" && v > 0);
              const hasData = monthData && (monthData.profit > 0 || hasAmounts);
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

      {/* Modal Comisiones: detalle de comisiones agregadas + formulario para agregar (con nota) */}
      <Dialog open={comisionesModalOpen} onOpenChange={(open) => { setComisionesModalOpen(open); if (!open) { setCommissionAmount(""); setCommissionNote(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Comisiones</DialogTitle>
            <DialogDescription>
              Detalle de las comisiones agregadas. Puedes agregar una nueva con monto y nota.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div>
              <p className="text-sm font-medium mb-2">Detalle de comisiones agregadas</p>
              {comisionesDetalleList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay comisiones. Agrega una abajo.</p>
              ) : (
                <div className="max-h-[220px] overflow-y-auto space-y-2 rounded-lg border bg-muted/30 p-3">
                  {comisionesDetalleList.map((item) => (
                    <div key={item.key} className="flex flex-col gap-0.5 py-2 border-b border-border/60 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium">{item.dateLabel}</span>
                          <span className="text-sm font-semibold tabular-nums ml-2">{formatCurrency(item.amount)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMoveCommissionEntry({ sourceKey: item.sourceKey, entryIndex: item.entryIndex, amount: item.amount, note: item.note });
                            const [y, m] = item.sourceKey.split("-").map(Number);
                            if (m === 3) {
                              setMoveTargetMonth(2);
                              setMoveTargetYear(y);
                            }
                          }}
                          className="text-xs text-primary hover:underline shrink-0"
                        >
                          Cambiar mes
                        </button>
                      </div>
                      {item.note !== "—" && (
                        <p className="text-xs text-muted-foreground">{item.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Agregar comisión</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="commission-amount">Monto (CLP)</Label>
                  <Input
                    id="commission-amount"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Ej: 150000"
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission-note">Nota / detalle</Label>
                  <Input
                    id="commission-note"
                    type="text"
                    placeholder="Ej: Comisión venta Toyota Corolla"
                    value={commissionNote}
                    onChange={(e) => setCommissionNote(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Mes</Label>
                    <Select value={String(commissionMonth)} onValueChange={(v) => setCommissionMonth(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((nombre, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Año</Label>
                    <Select value={String(commissionYear)} onValueChange={(v) => setCommissionYear(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const current = new Date().getFullYear();
                          const years = new Set([...yearsWithData(), current - 1, current - 2, current + 1]);
                          return Array.from(years).sort((a, b) => b - a).map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={saveCommission}
                  disabled={saving || !commissionAmount.trim()}
                  className="w-full py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Agregar comisión"}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: mover comisión a otro mes */}
      <Dialog open={moveCommissionEntry != null} onOpenChange={(open) => !open && setMoveCommissionEntry(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover comisión a otro mes</DialogTitle>
            <DialogDescription>
              {moveCommissionEntry && (
                <>Comisión de {formatCurrency(moveCommissionEntry.amount)} → elige el mes que corresponde.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={String(moveTargetMonth)} onValueChange={(v) => setMoveTargetMonth(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((nombre, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año</Label>
              <Select value={String(moveTargetYear)} onValueChange={(v) => setMoveTargetYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const current = new Date().getFullYear();
                    const years = new Set([...yearsWithData(), current - 1, current, current + 1]);
                    return Array.from(years).sort((a, b) => b - a).map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setMoveCommissionEntry(null)}
              className="px-4 py-2 rounded-md border border-input bg-background hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={moveCommissionToMonth}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Moviendo…" : "Mover comisión"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ventana emergente: detalle por beneficiario (fechas y montos) */}
      <Dialog open={beneficiaryDetailName != null} onOpenChange={(open) => !open && setBeneficiaryDetailName(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {beneficiaryDetailName ? `Detalle — ${beneficiaryDetailName}` : "Detalle"}
            </DialogTitle>
            <DialogDescription>
              Fechas en que se agregaron montos y monto en cada ocasión.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {detailEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay montos registrados para este beneficiario.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {detailEntries.map(({ key, dateLabel, amount }) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                    <span className="text-sm font-medium">{dateLabel}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {detailEntries.length > 0 && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(detailTotal)}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
