import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { gastosEmpresaService, type ExpenseType, type GastoEmpresaWithInversor } from "@/lib/services/gastosEmpresa";
import { expenseTypesService, type ExpenseTypeRow } from "@/lib/services/expenseTypes";
import { ingresosEmpresaService } from "@/lib/services/ingresosEmpresa";
import { saleService } from "@/lib/services/sales";
import { supabase } from "@/lib/supabase";
import {
  BarChart3,
  Calendar,
  DollarSign,
  Filter,
  LayoutList,
  Pencil,
  Plus,
  Receipt,
  Settings2,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const INVERSOR_OPCIONES = ["Mike", "Jota", "Ronald", "HessenMotors", "Antonio"] as const;

const INVERSOR_COLORS: Record<(typeof INVERSOR_OPCIONES)[number], string> = {
  Mike: "bg-blue-100 text-blue-800 border-blue-200",
  Jota: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Ronald: "bg-amber-100 text-amber-800 border-amber-200",
  HessenMotors: "bg-violet-100 text-violet-800 border-violet-200",
  Antonio: "bg-sky-100 text-sky-800 border-sky-200",
};

const INVERSORES_A_DEVOLVER = ["Jota", "Mike", "Ronald"] as const;

/** Inversor cuyos gastos son de la empresa: no se devuelven. */
const INVERSOR_EMPRESA = "HessenMotors";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(value);
}

/** Parsea YYYY-MM-DD como fecha local (evita que medianoche UTC se vea como día anterior en Chile). */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr: string) {
  return parseLocalDate(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type SaleForIngreso = {
  id: string;
  sale_price: number;
  margin: number;
  sale_date: string;
  vehicle_description: string | null;
  vehicle?: { make: string; model: string; year: number } | null;
  seller?: { full_name: string | null } | null;
};

/** Datos de ingreso desde tabla ingresos_empresa (ej. Comisión Crédito). */
type IngresoEmpresaForList = {
  margin: number;
  income_date: string;
  description: string | null;
  etiqueta: string;
  source: "ingreso_empresa";
};

/** Una fila de la lista unificada: gasto o ingreso (venta o ingreso empresa). */
type MovimientoRow =
  | { tipo: "gasto"; id: string; date: string; data: GastoEmpresaWithInversor }
  | { tipo: "ingreso"; id: string; date: string; data: SaleForIngreso | IngresoEmpresaForList };

function buildMovimientos(
  gastos: GastoEmpresaWithInversor[],
  salesList: SaleForIngreso[],
  ingresosEmpresaList: { id: string; amount: number; description: string | null; etiqueta: string; income_date: string }[]
): MovimientoRow[] {
  const gastosRows: MovimientoRow[] = gastos.map((g) => ({
    tipo: "gasto" as const,
    id: g.id,
    date: g.expense_date,
    data: g,
  }));
  const ingresosVentasRows: MovimientoRow[] = salesList.map((s) => ({
    tipo: "ingreso" as const,
    id: `sale-${s.id}`,
    date: s.sale_date,
    data: s,
  }));
  const ingresosEmpresaRows: MovimientoRow[] = ingresosEmpresaList.map((i) => ({
    tipo: "ingreso" as const,
    id: `ingreso-empresa-${i.id}`,
    date: i.income_date,
    data: {
      margin: i.amount,
      income_date: i.income_date,
      description: i.description,
      etiqueta: i.etiqueta,
      source: "ingreso_empresa" as const,
    } as IngresoEmpresaForList,
  }));
  const all = [...gastosRows, ...ingresosVentasRows, ...ingresosEmpresaRows];
  all.sort((a, b) => (b.date === a.date ? 0 : b.date > a.date ? 1 : -1));
  return all;
}

function ingresoDescription(row: MovimientoRow): string {
  if (row.tipo !== "ingreso") return "";
  const d = row.data;
  if ("source" in d && d.source === "ingreso_empresa") {
    return `${d.description ?? "Ingreso"} · ${d.etiqueta} · ${formatCurrency(Number(d.margin))}`;
  }
  const vehicleText =
    d.vehicle_description?.trim() ||
    (d.vehicle
      ? `${d.vehicle.make} ${d.vehicle.model} ${d.vehicle.year}`
      : "Venta");
  return `${vehicleText} · Ganancia ${formatCurrency(Number(d.margin))}`;
}

export default function Finance() {
  const { user } = useAuth();
  const [gastos, setGastos] = useState<GastoEmpresaWithInversor[]>([]);
  const [sales, setSales] = useState<SaleForIngreso[]>([]);
  const [ingresosEmpresa, setIngresosEmpresa] = useState<{ id: string; amount: number; description: string | null; etiqueta: string; income_date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ExpenseType | "all">("all");
  const [filterInversor, setFilterInversor] = useState<string | "all">("all");
  const [filterMovimiento, setFilterMovimiento] = useState<"all" | "gasto" | "ingreso">("all");
  const [filterDevolucion, setFilterDevolucion] = useState<"all" | "pendiente" | "realizado">("all");
  const [filterOrdenFecha, setFilterOrdenFecha] = useState<"ascendente" | "descendente">("descendente");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [gastosModalOpen, setGastosModalOpen] = useState(false);
  const [filterModalEtiqueta, setFilterModalEtiqueta] = useState<ExpenseType | "all">("all");
  const [filterModalInversor, setFilterModalInversor] = useState<string>("all");
  const [pendientesModalOpen, setPendientesModalOpen] = useState(false);
  const [filterPendientesInversor, setFilterPendientesInversor] = useState<string>("all");
  const [filterPendientesEtiqueta, setFilterPendientesEtiqueta] = useState<ExpenseType | "all">("all");
  const [expenseTypes, setExpenseTypes] = useState<ExpenseTypeRow[]>([]);
  const [etiquetasModalOpen, setEtiquetasModalOpen] = useState(false);
  const [editEtiquetaId, setEditEtiquetaId] = useState<string | null>(null);
  const [formEtiqueta, setFormEtiqueta] = useState({ code: "", label: "" });
  const [form, setForm] = useState({
    amount: "",
    description: "",
    expense_type: "otros" as ExpenseType,
    inversor_id: null as string | null,
    inversor_name: "",
    expense_date: new Date().toISOString().slice(0, 10),
    branch_id: null as string | null,
    devolucion: false,
  });

  const loadGastos = useCallback(async () => {
    setLoading(true);
    try {
      const [gastosData, salesData, ingresosEmpresaData] = await Promise.all([
        gastosEmpresaService.getAll(),
        saleService
          .getAll({ status: "completada", paymentStatus: "realizado" })
          .then((data) => data ?? [])
          .catch((err) => {
            console.error("Error cargando ventas para ingresos:", err);
            return [];
          }),
        ingresosEmpresaService.getAll().catch((err) => {
          console.error("Error cargando ingresos empresa:", err);
          return [];
        }),
      ]);
      setGastos(gastosData);
      setIngresosEmpresa(
        ingresosEmpresaData.map((i) => ({
          id: i.id,
          amount: Number(i.amount),
          description: i.description,
          etiqueta: i.etiqueta,
          income_date: i.income_date,
        }))
      );
      type SaleRaw = {
        id: string;
        sale_price: number | string;
        margin: number | string | null;
        sale_date: string;
        payment_status?: string | null;
        vehicle_description?: string | null;
        vehicle?: { make: string; model: string; year: number } | null;
        seller?: { full_name: string | null } | null;
      };
      const onlyPagoRealizado = (salesData as SaleRaw[]).filter(
        (s) => s.payment_status === "realizado"
      );
      setSales(
        onlyPagoRealizado.map((s) => ({
          id: s.id,
          sale_price: Number(s.sale_price),
          margin: Number(s.margin ?? 0),
          sale_date: s.sale_date,
          vehicle_description: s.vehicle_description ?? null,
          vehicle: s.vehicle ?? null,
          seller: s.seller ?? null,
        }))
      );
    } catch (e) {
      console.error("Error cargando Gastos/Ingresos:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime: cuando una venta pasa a "pago realizado", actualizar la lista de ingresos
  useEffect(() => {
    const channel = supabase
      .channel("finance-sales-payment")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          // Refrescar ventas para que la nueva ganancia aparezca en ingresos
          saleService
            .getAll({ status: "completada", paymentStatus: "realizado" })
            .then((data) => {
              if (data == null) return;
              type SaleRaw = {
                id: string;
                sale_price: number | string;
                margin: number | string | null;
                sale_date: string;
                payment_status?: string | null;
                vehicle_description?: string | null;
                vehicle?: { make: string; model: string; year: number } | null;
                seller?: { full_name: string | null } | null;
              };
              const onlyPagoRealizado = (data as SaleRaw[]).filter(
                (s) => s.payment_status === "realizado"
              );
              setSales(
                onlyPagoRealizado.map((s) => ({
                  id: s.id,
                  sale_price: Number(s.sale_price),
                  margin: Number(s.margin ?? 0),
                  sale_date: s.sale_date,
                  vehicle_description: s.vehicle_description ?? null,
                  vehicle: s.vehicle ?? null,
                  seller: s.seller ?? null,
                }))
              );
            })
            .catch((err) => console.error("Error refrescando ingresos por realtime:", err));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const displayInversor = (g: GastoEmpresaWithInversor) =>
    g.inversor?.full_name || g.inversor_name || "—";

  const getExpenseTypeLabel = (code: string) =>
    expenseTypes.find((t) => t.code === code)?.label ?? code;

  const loadExpenseTypes = useCallback(async () => {
    try {
      const data = await expenseTypesService.getAll();
      setExpenseTypes(data);
    } catch (e) {
      console.error("Error cargando tipos de gasto:", e);
    }
  }, []);

  const gastosFiltrados =
    filterInversor === "all"
      ? gastos
      : gastos.filter((g) => displayInversor(g) === filterInversor);

  const gastosPorDevolucion =
    filterDevolucion === "all"
      ? gastosFiltrados
      : filterDevolucion === "pendiente"
        ? gastosFiltrados.filter((g) => !(g.devolucion ?? false))
        : gastosFiltrados.filter((g) => g.devolucion === true);

  const gastosParaLista =
    filterType === "all"
      ? gastosPorDevolucion
      : gastosPorDevolucion.filter((g) => g.expense_type === filterType);

  const incluirIngresosVentas =
    filterType === "all" && filterInversor === "all" && filterDevolucion === "all";

  const movimientos = buildMovimientos(gastosParaLista, incluirIngresosVentas ? sales : [], incluirIngresosVentas ? ingresosEmpresa : []);
  const movimientosFiltrados =
    filterMovimiento === "all"
      ? movimientos
      : movimientos.filter((m) => m.tipo === filterMovimiento);

  const balanceLista = movimientosFiltrados.reduce((acc, row) => {
    if (row.tipo === "ingreso") return acc + Number(row.data.margin);
    return acc - Number(row.data.amount);
  }, 0);

  // Orden por fecha: ascendente = más antiguos primero, descendente = más recientes primero
  const movimientosOrdenados = [...movimientosFiltrados].sort((a, b) => {
    if (a.date === b.date) return 0;
    if (filterOrdenFecha === "ascendente") return a.date < b.date ? -1 : 1;
    return a.date > b.date ? -1 : 1;
  });

  const saldosAcumulados = movimientosOrdenados.map((_, i) =>
    movimientosOrdenados.slice(0, i + 1).reduce((acc, row) => {
      if (row.tipo === "ingreso") return acc + Number(row.data.margin);
      return acc - Number(row.data.amount);
    }, 0)
  );

  const totalIngresos =
    sales.reduce((sum, s) => sum + Number(s.margin), 0) +
    ingresosEmpresa.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalGastos = gastos.reduce((sum, g) => sum + Number(g.amount), 0);
  const gastosPendientes = gastos.filter(
    (g) => !(g.devolucion ?? false) && displayInversor(g) !== INVERSOR_EMPRESA
  );
  const totalGastosPendientes = gastosPendientes.reduce((sum, g) => sum + Number(g.amount), 0);
  const balance = totalIngresos - totalGastos;

  const aDevolverPorInversor: Record<(typeof INVERSORES_A_DEVOLVER)[number], number> = {
    Jota: gastos
      .filter((g) => displayInversor(g) === "Jota" && !(g.devolucion ?? false))
      .reduce((sum, g) => sum + Number(g.amount), 0),
    Mike: gastos
      .filter((g) => displayInversor(g) === "Mike" && !(g.devolucion ?? false))
      .reduce((sum, g) => sum + Number(g.amount), 0),
    Ronald: gastos
      .filter((g) => displayInversor(g) === "Ronald" && !(g.devolucion ?? false))
      .reduce((sum, g) => sum + Number(g.amount), 0),
  };

  // Modal "Gastos por etiqueta y fecha": filtrado por etiqueta e inversor, orden por fecha (más reciente primero), agrupado por fecha
  const gastosParaModal =
    filterModalEtiqueta === "all"
      ? gastos
      : gastos.filter((g) => g.expense_type === filterModalEtiqueta);
  const gastosParaModalPorInversor =
    filterModalInversor === "all"
      ? gastosParaModal
      : gastosParaModal.filter((g) => displayInversor(g) === filterModalInversor);
  const gastosModalOrdenados = [...gastosParaModalPorInversor].sort((a, b) =>
    b.expense_date.localeCompare(a.expense_date)
  );
  const saldosGastosModal = gastosModalOrdenados.map((_, i) =>
    gastosModalOrdenados
      .slice(0, i + 1)
      .reduce((acc, g) => acc - Number(g.amount), 0)
  );
  const indexGastoParaSaldo = new Map(gastosModalOrdenados.map((g, i) => [g.id, i]));
  const gastosAgrupadosPorFecha = gastosModalOrdenados.reduce(
    (acc, g) => {
      if (!acc[g.expense_date]) acc[g.expense_date] = [];
      acc[g.expense_date].push(g);
      return acc;
    },
    {} as Record<string, typeof gastosModalOrdenados>
  );
  const fechasOrdenadasModal = Object.keys(gastosAgrupadosPorFecha).sort((a, b) => b.localeCompare(a));
  const totalGastosModal = gastosModalOrdenados.reduce((sum, g) => sum + Number(g.amount), 0);

  useEffect(() => {
    loadGastos();
  }, [loadGastos]);

  useEffect(() => {
    loadExpenseTypes();
  }, [loadExpenseTypes]);

  useEffect(() => {
    async function loadBranches() {
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (data) setBranches(data);
    }
    loadBranches();
  }, []);

  const hoy = new Date();
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hace30Dias.getDate() - 30);
  const gastosUltimos30Dias = gastos.filter(
    (g) => parseLocalDate(g.expense_date) >= hace30Dias
  );
  const totalUltimos30Dias = gastosUltimos30Dias.reduce(
    (sum, g) => sum + Number(g.amount),
    0
  );
  const promedioGastoDiario30 =
    totalUltimos30Dias > 0 ? Math.round(totalUltimos30Dias / 30) : 0;

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const gastosDelMes = gastos.filter((g) => {
    const d = parseLocalDate(g.expense_date);
    return d >= inicioMes && d <= finMes;
  });
  const totalDelMes = gastosDelMes.reduce((sum, g) => sum + Number(g.amount), 0);

  const promedioPorGasto =
    gastosUltimos30Dias.length > 0
      ? Math.round(totalUltimos30Dias / gastosUltimos30Dias.length)
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount.replace(/\D/g, "").replace(/^0+/, "") || "0");
    if (amount <= 0) return;
    try {
      if (editingId) {
        await gastosEmpresaService.update(editingId, {
          amount,
          description: form.description.trim() || null,
          expense_type: form.expense_type,
          inversor_id: null,
          inversor_name: form.inversor_name.trim() || null,
          expense_date: form.expense_date,
          devolucion: form.devolucion,
        });
        setEditingId(null);
      } else {
        const branchId =
          user?.role === "admin" && form.branch_id
            ? form.branch_id
            : user?.branch_id ?? null;
        await gastosEmpresaService.create({
          branch_id: branchId,
          amount,
          description: form.description.trim() || null,
          expense_type: form.expense_type,
          inversor_id: form.inversor_id || null,
          inversor_name: form.inversor_name.trim() || null,
          expense_date: form.expense_date,
          devolucion: form.devolucion,
          created_by: user?.id ?? null,
        });
      }
      setForm({
        amount: "",
        description: "",
        expense_type: "otros",
        inversor_id: null,
        inversor_name: "",
        expense_date: new Date().toISOString().slice(0, 10),
        branch_id: null,
        devolucion: false,
      });
      setDialogOpen(false);
      loadGastos();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (g: GastoEmpresaWithInversor) => {
    setEditingId(g.id);
    setForm({
      amount: String(Number(g.amount)),
      description: g.description ?? "",
      expense_type: g.expense_type,
      inversor_id: null,
      inversor_name: g.inversor?.full_name ?? g.inversor_name ?? "",
      expense_date: g.expense_date,
      branch_id: g.branch_id ?? null,
      devolucion: g.devolucion ?? false,
    });
    setDialogOpen(true);
  };

  const handleSaveEtiqueta = async () => {
    const label = formEtiqueta.label.trim();
    if (!label) return;
    try {
      if (editEtiquetaId) {
        await expenseTypesService.update(editEtiquetaId, { label });
      } else {
        await expenseTypesService.create({
          label,
          code: formEtiqueta.code.trim() || label.toLowerCase().replace(/\s+/g, "_"),
          sort_order: expenseTypes.length,
        });
      }
      setFormEtiqueta({ code: "", label: "" });
      setEditEtiquetaId(null);
      await loadExpenseTypes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteEtiqueta = async (id: string, code: string) => {
    try {
      const count = await expenseTypesService.countGastosByCode(code);
      if (count > 0) {
        alert(`No se puede eliminar: hay ${count} gasto(s) con esta etiqueta. Cambia su tipo antes de eliminarla.`);
        return;
      }
      if (!confirm("¿Eliminar esta etiqueta?")) return;
      await expenseTypesService.remove(id);
      if (editEtiquetaId === id) setEditEtiquetaId(null);
      await loadExpenseTypes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await gastosEmpresaService.remove(id);
      setDeleteConfirmId(null);
      loadGastos();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finanzas</h1>
          <p className="text-muted-foreground mt-2">
            Control de ingresos (ventas) y gastos · Depuración y balance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setGastosModalOpen(true)}>
            <LayoutList className="h-4 w-4 mr-2" />
            Gastos por etiqueta
          </Button>
          <Button
            onClick={() => {
              setEditingId(null);
              const defaultType = expenseTypes.length ? expenseTypes[0].code : "otros";
              setForm({
                amount: "",
                description: "",
                expense_type: defaultType,
                inversor_id: null,
                inversor_name: "",
                expense_date: new Date().toISOString().slice(0, 10),
                branch_id: null,
                devolucion: false,
              });
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Gasto
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {loading ? "…" : formatCurrency(totalIngresos)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pago realizado · {sales.length} venta{sales.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total gastos</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : formatCurrency(totalGastos)}
            </div>
            <p className="text-xs text-muted-foreground">
              {gastos.length} gasto{gastos.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer transition-colors hover:bg-muted/50"
          onClick={() => setPendientesModalOpen(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos pendientes</CardTitle>
            <Receipt className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? "…" : formatCurrency(totalGastosPendientes)}
            </div>
            <p className="text-xs text-muted-foreground">
              Sin devolver · {gastosPendientes.length} gasto{gastosPendientes.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {loading ? "…" : formatCurrency(balance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos − Gastos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resumen 30 días</CardTitle>
            <BarChart3 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : formatCurrency(totalUltimos30Dias)}
            </div>
            <p className="text-xs text-muted-foreground">
              Gastos últimos 30 días
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio gasto diario</CardTitle>
            <Calendar className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : formatCurrency(promedioGastoDiario30)}
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio diario en últimos 30 días
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">A devolver por inversor</h2>
        <p className="text-sm text-muted-foreground">
          Monto a devolver según gastos no devueltos (devolución = No).
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {INVERSORES_A_DEVOLVER.map((nombre) => {
            const monto = aDevolverPorInversor[nombre];
            const colorClass = INVERSOR_COLORS[nombre];
            return (
              <Card key={nombre}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                      {nombre}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {loading ? "…" : formatCurrency(monto)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    A devolver a {nombre}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Gastos / Ingresos
          </CardTitle>
          <CardDescription>
            Lista unificada: ingresos por ventas (tipo Vehículo) y gastos. Depuración y control de lo que entra y sale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filtros:</span>
            </div>
            <Select value={filterMovimiento} onValueChange={(v) => setFilterMovimiento(v as "all" | "gasto" | "ingreso")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ingreso">Ingresos</SelectItem>
                <SelectItem value="gasto">Gastos</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as ExpenseType | "all")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {expenseTypes.map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setEtiquetasModalOpen(true)}
                title="Gestionar etiquetas de tipo"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
            <Select value={filterInversor} onValueChange={setFilterInversor}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Inversor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los inversores</SelectItem>
                {INVERSOR_OPCIONES.map((nombre) => (
                  <SelectItem key={nombre} value={nombre}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDevolucion} onValueChange={(v) => setFilterDevolucion(v as "all" | "pendiente" | "realizado")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Devolución" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="realizado">Realizado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOrdenFecha} onValueChange={(v) => setFilterOrdenFecha(v as "ascendente" | "descendente")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Orden fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ascendente">Más antiguos primero</SelectItem>
                <SelectItem value="descendente">Más recientes primero</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando…</div>
          ) : movimientosFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No hay movimientos. Agrega un gasto con &quot;Nuevo Gasto&quot; o registra ventas en Ventas.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-auto max-h-[min(70vh,600px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Movimiento</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Inversor</TableHead>
                    <TableHead>Devolución</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right min-w-[120px]">Saldo</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {movimientosOrdenados.map((row, index) => {
                      const saldo = saldosAcumulados[index];
                      return row.tipo === "gasto" ? (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Badge variant="outline" className="bg-muted/50">Gasto</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(row.data.expense_date)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{getExpenseTypeLabel(row.data.expense_type)}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {row.data.description || "—"}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const name = displayInversor(row.data);
                              const badgeClass = name !== "—" && INVERSOR_OPCIONES.includes(name as (typeof INVERSOR_OPCIONES)[number])
                                ? INVERSOR_COLORS[name as (typeof INVERSOR_OPCIONES)[number]]
                                : null;
                              return badgeClass ? (
                                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                                  {name}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <User className="h-3.5 w-3.5" />
                                  {name}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.data.devolucion ? "default" : "outline"}>
                              {row.data.devolucion ? "Sí" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            -{formatCurrency(Number(row.data.amount))}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {saldo >= 0 ? "+" : ""}
                            {formatCurrency(saldo)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(row.data)} title="Editar gasto">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(row.id)} title="Eliminar gasto">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                    ) : (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Ingreso</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(row.date)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {"source" in row.data && row.data.source === "ingreso_empresa" ? row.data.etiqueta : "Vehículo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[260px] truncate">
                            {ingresoDescription(row)}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">
                              {"seller" in row.data && row.data.seller ? row.data.seller?.full_name || "—" : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground">—</span>
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            +{formatCurrency(Number(row.data.margin))}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {saldo >= 0 ? "+" : ""}
                            {formatCurrency(saldo)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={6} className="text-right font-semibold text-muted-foreground">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">—</TableCell>
                    <TableCell
                      className={`text-right font-bold ${balanceLista >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {balanceLista >= 0 ? "+" : ""}
                      {formatCurrency(balanceLista)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Modifica los datos del gasto."
                : "Registra un gasto con tipo e inversor para llevar el control de la empresa"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto (CLP)</Label>
                <Input
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value.replace(/\D/g, "") }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_date">Fecha</Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de gasto</Label>
              <Select
                value={form.expense_type}
                onValueChange={(v) => setForm((f) => ({ ...f, expense_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseTypes.map((t) => (
                    <SelectItem key={t.id} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Inversor</Label>
              <Select
                value={
                  form.inversor_name && INVERSOR_OPCIONES.includes(form.inversor_name as (typeof INVERSOR_OPCIONES)[number])
                    ? form.inversor_name
                    : "none"
                }
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    inversor_id: null,
                    inversor_name: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar inversor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No asignado</SelectItem>
                  {INVERSOR_OPCIONES.map((nombre) => (
                    <SelectItem key={nombre} value={nombre}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Devolución</Label>
              <Select
                value={form.devolucion ? "si" : "no"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, devolucion: v === "si" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="si">Sí</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {user?.role === "admin" && branches.length > 1 && (
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <Select
                  value={form.branch_id ?? user?.branch_id ?? ""}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      branch_id: v ? v : null,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Detalle del gasto"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingId(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!form.amount || parseFloat(form.amount) <= 0}>
                {editingId ? "Guardar cambios" : "Guardar gasto"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={gastosModalOpen} onOpenChange={setGastosModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutList className="h-5 w-5" />
              Gastos por etiqueta y fecha
            </DialogTitle>
            <DialogDescription>
              Filtra por etiqueta e inversor. Orden: fecha del más reciente al más viejo. Gastos del mismo día se muestran juntos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 shrink-0 pb-2">
            <Select value={filterModalEtiqueta} onValueChange={(v) => setFilterModalEtiqueta(v as ExpenseType | "all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Etiqueta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las etiquetas</SelectItem>
                {expenseTypes.map((t) => (
                  <SelectItem key={t.id} value={t.code}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterModalInversor} onValueChange={setFilterModalInversor}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Inversor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los inversores</SelectItem>
                {INVERSOR_OPCIONES.map((nombre) => (
                  <SelectItem key={nombre} value={nombre}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Cargando…</div>
            ) : gastosModalOrdenados.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No hay gastos con los filtros actuales.
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {fechasOrdenadasModal.map((fecha) => (
                    <div key={fecha}>
                      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 mb-3 sticky top-0 bg-background/95 backdrop-blur py-1 z-10">
                        <Calendar className="h-4 w-4" />
                        {formatDate(fecha)}
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {gastosAgrupadosPorFecha[fecha].map((g) => {
                          const index = indexGastoParaSaldo.get(g.id) ?? 0;
                          const name = displayInversor(g);
                          const badgeClass =
                            name !== "—" && INVERSOR_OPCIONES.includes(name as (typeof INVERSOR_OPCIONES)[number])
                              ? INVERSOR_COLORS[name as (typeof INVERSOR_OPCIONES)[number]]
                              : null;
                          return (
                            <Card key={g.id} className="overflow-hidden">
                              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-start justify-between gap-2">
                                <Badge variant="secondary">{getExpenseTypeLabel(g.expense_type)}</Badge>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEdit(g)}
                                    title="Editar gasto"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteConfirmId(g.id)}
                                    title="Eliminar gasto"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="px-4 pb-4 pt-0 space-y-2">
                                <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
                                  {g.description || "—"}
                                </p>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3.5 w-3.5 shrink-0" />
                                  {name}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={g.devolucion ? "default" : "outline"} className="text-xs">
                                    {g.devolucion ? "Devolución Sí" : "Pendiente"}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t">
                                  <span className="text-xs text-muted-foreground">Monto</span>
                                  <span className="font-medium text-red-600">
                                    -{formatCurrency(Number(g.amount))}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Saldo</span>
                                  <span
                                    className={`font-medium ${saldosGastosModal[index] >= 0 ? "text-emerald-600" : "text-red-600"}`}
                                  >
                                    {saldosGastosModal[index] >= 0 ? "+" : ""}
                                    {formatCurrency(saldosGastosModal[index])}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <Card className="mt-4 bg-muted/60">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Total gastos</span>
                    <span className="font-bold text-red-600">-{formatCurrency(totalGastosModal)}</span>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={etiquetasModalOpen}
        onOpenChange={(open) => {
          setEtiquetasModalOpen(open);
          if (!open) {
            setEditEtiquetaId(null);
            setFormEtiqueta({ code: "", label: "" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Gestionar etiquetas de tipo
            </DialogTitle>
            <DialogDescription>
              Agrega, edita o elimina los tipos de gasto (etiquetas). El código se usa internamente; no elimines una etiqueta que tenga gastos asociados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nombre (ej. Operación)"
                value={formEtiqueta.label}
                onChange={(e) => setFormEtiqueta((f) => ({ ...f, label: e.target.value }))}
              />
              <Input
                placeholder="Código (opcional)"
                value={formEtiqueta.code}
                onChange={(e) => setFormEtiqueta((f) => ({ ...f, code: e.target.value }))}
                className="w-32"
              />
              <Button onClick={handleSaveEtiqueta} disabled={!formEtiqueta.label.trim()}>
                {editEtiquetaId ? "Guardar" : "Agregar"}
              </Button>
            </div>
            <div className="border rounded-md divide-y max-h-[280px] overflow-auto">
              {expenseTypes.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{t.label}</span>
                    <span className="text-muted-foreground text-sm ml-2">({t.code})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditEtiquetaId(t.id);
                        setFormEtiqueta({ code: t.code, label: t.label });
                      }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteEtiqueta(t.id, t.code)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pendientesModalOpen} onOpenChange={(open) => { setPendientesModalOpen(open); if (!open) { setFilterPendientesInversor("all"); setFilterPendientesEtiqueta("all"); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-red-500" />
              Gastos pendientes (sin devolver)
            </DialogTitle>
            <DialogDescription>
              Gastos sin devolver (excluye HessenMotors: son gastos de la empresa y no se devuelven). Ordenados por fecha (más reciente primero).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground shrink-0">Etiqueta:</span>
            <Select value={filterPendientesEtiqueta} onValueChange={(v) => setFilterPendientesEtiqueta(v as ExpenseType | "all")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas las etiquetas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las etiquetas</SelectItem>
                {expenseTypes.map((t) => (
                  <SelectItem key={t.id} value={t.code}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground shrink-0">Inversor:</span>
            <Select value={filterPendientesInversor} onValueChange={setFilterPendientesInversor}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos los inversores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los inversores</SelectItem>
                {INVERSOR_OPCIONES.map((nombre) => (
                  <SelectItem key={nombre} value={nombre}>
                    {nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Cargando…</div>
            ) : gastosPendientes.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No hay gastos pendientes. Todos tienen devolución registrada.
              </div>
            ) : (() => {
              const porInversor =
                filterPendientesInversor === "all"
                  ? gastosPendientes
                  : gastosPendientes.filter((g) => displayInversor(g) === filterPendientesInversor);
              const pendientesFiltrados =
                filterPendientesEtiqueta === "all"
                  ? porInversor
                  : porInversor.filter((g) => g.expense_type === filterPendientesEtiqueta);
              const totalFiltrado = pendientesFiltrados.reduce((sum, g) => sum + Number(g.amount), 0);
              return pendientesFiltrados.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No hay gastos pendientes con los filtros seleccionados.
                </div>
              ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...pendientesFiltrados]
                    .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
                    .map((g) => {
                      const name = displayInversor(g);
                      const badgeClass =
                        name !== "—" && INVERSOR_OPCIONES.includes(name as (typeof INVERSOR_OPCIONES)[number])
                          ? INVERSOR_COLORS[name as (typeof INVERSOR_OPCIONES)[number]]
                          : null;
                      return (
                        <Card key={g.id} className="overflow-hidden">
                          <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-start justify-between gap-2">
                            <Badge variant="secondary">{getExpenseTypeLabel(g.expense_type)}</Badge>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(g);
                                }}
                                title="Editar gasto"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(g.id);
                                }}
                                title="Eliminar gasto"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="px-4 pb-4 pt-0 space-y-2">
                            <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
                              {g.description || "—"}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              {formatDate(g.expense_date)}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {badgeClass ? (
                                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                                  {name}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                  <User className="h-3.5 w-3.5" />
                                  {name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <span className="text-xs text-muted-foreground">Monto a devolver</span>
                              <span className="font-medium text-red-600">
                                -{formatCurrency(Number(g.amount))}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
                <Card className="mt-4 bg-muted/60">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">
                      Total pendiente
                      {filterPendientesInversor !== "all" || filterPendientesEtiqueta !== "all"
                        ? ` (${[filterPendientesEtiqueta !== "all" ? getExpenseTypeLabel(filterPendientesEtiqueta) : null, filterPendientesInversor !== "all" ? filterPendientesInversor : null].filter(Boolean).join(" · ")})`
                        : ""}
                    </span>
                    <span className="font-bold text-red-600">-{formatCurrency(totalFiltrado)}</span>
                  </CardContent>
                </Card>
              </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar este gasto? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
