import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  DollarSign,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  User,
  Calendar,
  Filter,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  gastosEmpresaService,
  EXPENSE_TYPE_LABELS,
  type ExpenseType,
  type GastoEmpresaWithInversor,
} from "@/lib/services/gastosEmpresa";

const EXPENSE_TYPES: ExpenseType[] = [
  "operacion",
  "marketing",
  "servicios",
  "mantenimiento",
  "combustible",
  "seguros",
  "impuestos",
  "personal",
  "vehiculos",
  "otros",
];

const INVERSOR_OPCIONES = ["Mike", "Jota", "Ronald", "HessenMotors", "Antonio"] as const;

const INVERSOR_COLORS: Record<(typeof INVERSOR_OPCIONES)[number], string> = {
  Mike: "bg-blue-100 text-blue-800 border-blue-200",
  Jota: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Ronald: "bg-amber-100 text-amber-800 border-amber-200",
  HessenMotors: "bg-violet-100 text-violet-800 border-violet-200",
  Antonio: "bg-sky-100 text-sky-800 border-sky-200",
};

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

export default function Finance() {
  const { user } = useAuth();
  const [gastos, setGastos] = useState<GastoEmpresaWithInversor[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ExpenseType | "all">("all");
  const [filterInversor, setFilterInversor] = useState<string | "all">("all");
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
      const filters: Parameters<typeof gastosEmpresaService.getAll>[0] = {};
      if (filterType !== "all") filters.expenseType = filterType;
      const data = await gastosEmpresaService.getAll(filters);
      setGastos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  const displayInversor = (g: GastoEmpresaWithInversor) =>
    g.inversor?.full_name || g.inversor_name || "—";

  const gastosFiltrados =
    filterInversor === "all"
      ? gastos
      : gastos.filter((g) => displayInversor(g) === filterInversor);

  useEffect(() => {
    loadGastos();
  }, [loadGastos]);

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

  const totalGastos = gastosFiltrados.reduce((sum, g) => sum + Number(g.amount), 0);

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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este gasto?")) return;
    try {
      await gastosEmpresaService.remove(id);
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
            Gestión financiera y registro de gastos de la empresa
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
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
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total gastos (lista)</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : formatCurrency(totalGastos)}
            </div>
            <p className="text-xs text-muted-foreground">
              {gastosFiltrados.length} registro{gastosFiltrados.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resumen</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : formatCurrency(totalUltimos30Dias)}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos 30 días · {gastosUltimos30Dias.length} gasto{gastosUltimos30Dias.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos del mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : formatCurrency(totalDelMes)}
            </div>
            <p className="text-xs text-muted-foreground">
              Mes en curso · {gastosDelMes.length} gasto{gastosDelMes.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por gasto</CardTitle>
            <BarChart3 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "…" : formatCurrency(promedioPorGasto)}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos 30 días
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Gastos de la empresa
          </CardTitle>
          <CardDescription>
            Lista de gastos con tipo e inversor para el control por parte de la empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filtros:</span>
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as ExpenseType | "all")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {EXPENSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {EXPENSE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterInversor}
              onValueChange={setFilterInversor}
            >
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

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando gastos…</div>
          ) : gastosFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No hay gastos registrados. Agrega uno con &quot;Nuevo Gasto&quot;</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-auto max-h-[min(70vh,600px)]">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Inversor</TableHead>
                    <TableHead>Devolución</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gastosFiltrados.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(g.expense_date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{EXPENSE_TYPE_LABELS[g.expense_type]}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {g.description || "—"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const name = displayInversor(g);
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
                        <Badge variant={g.devolucion ? "default" : "outline"}>
                          {g.devolucion ? "Sí" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(g.amount))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
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
                            onClick={() => handleDelete(g.id)}
                            title="Eliminar gasto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
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
                onValueChange={(v) => setForm((f) => ({ ...f, expense_type: v as ExpenseType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EXPENSE_TYPE_LABELS[t]}
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
    </div>
  );
}
