import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useSales, type SaleWithRelations } from "@/hooks/useSales";
import { useVehicles } from "@/hooks/useVehicles";
import { toast } from "@/hooks/use-toast";
import { ingresosEmpresaService } from "@/lib/services/ingresosEmpresa";
import { saleService } from "@/lib/services/sales";
import { vehicleService } from "@/lib/services/vehicles";
import {
  Calendar,
  Car,
  DollarSign,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const VENDOR_OPTIONS = [
  { value: "HESSENMOTORS", label: "HESSENMOTORS" },
  { value: "MIAMIMOTORS", label: "MIAMIMOTORS" },
] as const;

const STOCK_ORIGIN_OPTIONS = [
  { value: "HESSENMOTORS", label: "HessenMotors" },
  { value: "MIAMIMOTORS", label: "Miami Motors" },
] as const;

const PAYMENT_OPTIONS = [
  { value: "contado", label: "Al contado" },
  { value: "financiamiento", label: "Con financiamiento" },
] as const;

const PAYMENT_STATUS_OPTIONS = [
  { value: "realizado", label: "Pago realizado" },
  { value: "pendiente", label: "Pago pendiente" },
] as const;

const COMMISSION_CREDIT_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "pagada", label: "Pagada" },
] as const;

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada",
};

const statusStyles: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-200",
  completada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelada: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "$0";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SalesManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const branchId = user?.branch_id ?? null;
  const {
    sales,
    stats,
    isLoading,
    statsLoading,
    createSale,
    isCreating,
    updateSale,
    isUpdating,
    deleteSale,
    isDeleting,
    refetch,
  } = useSales({ branchId, enabled: true });

  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formVendor, setFormVendor] = useState<string>("");
  const [formStockOrigin, setFormStockOrigin] = useState<string>("");
  const [formVehicleId, setFormVehicleId] = useState<string>("");
  const [formVehicleCustom, setFormVehicleCustom] = useState("");
  const [formSalePrice, setFormSalePrice] = useState("");
  const [formMargin, setFormMargin] = useState("");
  const [formSaleDate, setFormSaleDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("contado");
  const [formPaymentStatus, setFormPaymentStatus] = useState<string>("realizado");
  const [formCommissionCredit, setFormCommissionCredit] = useState<string>("pendiente");
  const [formDownPayment, setFormDownPayment] = useState("");
  const [formInstallments, setFormInstallments] = useState("");
  const [formCommission, setFormCommission] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formExpenses, setFormExpenses] = useState<{ id: string; description: string; amount: string }[]>([]);
  const [vehiclePopoverOpen, setVehiclePopoverOpen] = useState(false);
  const newSaleDialogRef = useRef<HTMLDivElement>(null);
  const [newSaleDialogEl, setNewSaleDialogEl] = useState<HTMLDivElement | null>(null);

  // Misma lista que inventario: todos los vehículos (disponible, reservado, vendido, etc.)
  const { vehicles: vehiclesByBranch = [] } = useVehicles({
    branchId: branchId ?? undefined,
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });
  const { data: vehiclesAllBranch = [] } = useQuery({
    queryKey: ["vehicles", "all"],
    queryFn: () => vehicleService.getAll({}),
    enabled: !branchId,
    staleTime: 2 * 60 * 1000,
  });
  const vehicles = branchId ? vehiclesByBranch : vehiclesAllBranch;

  const [selectedSale, setSelectedSale] = useState<SaleWithRelations | null>(null);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [editVendor, setEditVendor] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editMargin, setEditMargin] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editCommissionCredit, setEditCommissionCredit] = useState("");
  const [editCommission, setEditCommission] = useState("");
  const [editDownPayment, setEditDownPayment] = useState("");
  const [editInstallments, setEditInstallments] = useState("");
  const [editExpenses, setEditExpenses] = useState<{ id: string; description: string; amount: string }[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<SaleWithRelations | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") !== "true") return;
    setFormVendor("");
    setFormStockOrigin("");
    setFormVehicleId("");
    setFormVehicleCustom("");
    setFormSalePrice("");
    setFormMargin("");
    setFormSaleDate(format(new Date(), "yyyy-MM-dd"));
    setFormPaymentMethod("contado");
    setFormPaymentStatus("realizado");
    setFormDownPayment("");
    setFormInstallments("");
    setFormCommission("");
    setFormClientName("");
    setFormNotes("");
    setFormExpenses([]);
    setDialogOpen(true);
  }, [location.search]);

  useEffect(() => {
    const handleOpenNewSaleForm = () => handleOpenDialog();
    window.addEventListener("openNewSaleForm", handleOpenNewSaleForm);
    return () => window.removeEventListener("openNewSaleForm", handleOpenNewSaleForm);
  }, []);

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase();
    return sales.filter((s) => {
      const sellerName = (s.seller_name ?? s.seller?.full_name ?? "").toString().toLowerCase();
      const clientName = (s.client_name ?? s.lead?.full_name ?? "").toString().toLowerCase();
      const vehicleInfo = s.vehicle
        ? `${s.vehicle.make} ${s.vehicle.model} ${s.vehicle.year}`.toLowerCase()
        : (s.vehicle_description ?? "").toLowerCase();
      return (
        sellerName.includes(q) ||
        clientName.includes(q) ||
        vehicleInfo.includes(q) ||
        String(s.sale_price).includes(q)
      );
    });
  }, [sales, searchQuery]);

  const handleOpenDialog = () => {
    setFormVendor("");
    setFormStockOrigin("");
    setFormVehicleId("");
    setFormVehicleCustom("");
    setFormSalePrice("");
    setFormMargin("");
    setFormSaleDate(format(new Date(), "yyyy-MM-dd"));
    setFormPaymentMethod("contado");
    setFormPaymentStatus("realizado");
    setFormDownPayment("");
    setFormInstallments("");
    setFormCommission("");
    setFormClientName("");
    setFormNotes("");
    setFormExpenses([]);
    setVehiclePopoverOpen(false);
    setDialogOpen(true);
  };

  const addFormExpense = () => {
    setFormExpenses((prev) => [...prev, { id: crypto.randomUUID(), description: "", amount: "" }]);
  };
  const removeFormExpense = (id: string) => {
    setFormExpenses((prev) => prev.filter((e) => e.id !== id));
  };
  const updateFormExpense = (id: string, field: "description" | "amount", value: string) => {
    setFormExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };
  const parseAmount = (s: string) =>
    parseFloat(s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) || 0;
  const formExpensesTotal = formExpenses.reduce((sum, e) => sum + (Number.isNaN(parseAmount(e.amount)) ? 0 : parseAmount(e.amount)), 0);
  const formMarginNum = Number.isNaN(parseAmount(formMargin)) ? 0 : parseAmount(formMargin);
  const formNetMargin = formMarginNum - formExpensesTotal;

  const handleSelectSale = (sale: SaleWithRelations) => {
    setSelectedSale(sale);
    setDetailEditMode(false);
    setEditVendor(sale.seller_name ?? "");
    setEditSalePrice(String(sale.sale_price ?? ""));
    setEditMargin(String(sale.margin ?? ""));
    setEditNotes(sale.notes ?? "");
    setEditClientName(sale.client_name ?? "");
    setEditPaymentStatus(sale.payment_status ?? "");
    setEditPaymentMethod(sale.payment_method ?? "contado");
    setEditCommissionCredit(sale.commission_credit_status ?? "");
    setEditCommission(sale.commission != null ? String(sale.commission) : "");
    setEditDownPayment(sale.down_payment != null ? String(sale.down_payment) : "");
    setEditInstallments(sale.installments != null ? String(sale.installments) : "");
    setEditExpenses(
      (sale.sale_expenses ?? []).map((ex) => ({
        id: ex.id,
        description: ex.description ?? "",
        amount: String(ex.amount),
      }))
    );
  };

  const handleCloseDetail = () => {
    setSelectedSale(null);
    setDetailEditMode(false);
  };

  const addEditExpense = () => {
    setEditExpenses((prev) => [...prev, { id: crypto.randomUUID(), description: "", amount: "" }]);
  };
  const removeEditExpense = (id: string) => {
    setEditExpenses((prev) => prev.filter((e) => e.id !== id));
  };
  const updateEditExpense = (id: string, field: "description" | "amount", value: string) => {
    setEditExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };
  const editExpensesTotal = editExpenses.reduce((sum, e) => sum + (Number.isNaN(parseAmount(e.amount)) ? 0 : parseAmount(e.amount)), 0);
  const editMarginNum = Number.isNaN(parseAmount(editMargin)) ? 0 : parseAmount(editMargin);
  const editNetMargin = editMarginNum - editExpensesTotal;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;
    const salePrice = parseFloat(editSalePrice.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    const margin = parseFloat(editMargin.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(salePrice) || salePrice < 0) {
      toast({ title: "Error", description: "Monto vendido debe ser un número válido.", variant: "destructive" });
      return;
    }
    if (Number.isNaN(margin) || margin < 0) {
      toast({ title: "Error", description: "Monto ganado debe ser un número válido.", variant: "destructive" });
      return;
    }
    if (!editVendor.trim()) {
      toast({ title: "Error", description: "Selecciona el vendedor.", variant: "destructive" });
      return;
    }
    try {
      const commissionNum = editCommission.trim()
        ? parseFloat(editCommission.replace(/\s/g, "").replace(/\./g, "").replace(",", "."))
        : null;
      const downPaymentNum = editDownPayment.trim()
        ? parseFloat(editDownPayment.replace(/\s/g, "").replace(/\./g, "").replace(",", "."))
        : null;
      const installmentsNum = editInstallments.trim() ? parseInt(editInstallments, 10) || null : null;
      await updateSale({
        id: selectedSale.id,
        updates: {
          seller_name: editVendor,
          sale_price: salePrice,
          margin,
          notes: editNotes.trim() || null,
          client_name: editClientName.trim() || null,
          payment_status: editPaymentStatus.trim() || null,
          payment_method: editPaymentMethod.trim() || "contado",
          commission_credit_status: editPaymentMethod === "financiamiento" ? (editCommissionCredit.trim() || null) : null,
          commission: editPaymentMethod === "financiamiento" && commissionNum != null && !Number.isNaN(commissionNum) ? commissionNum : null,
          down_payment: editPaymentMethod === "financiamiento" && downPaymentNum != null && !Number.isNaN(downPaymentNum) ? downPaymentNum : null,
          installments: editPaymentMethod === "financiamiento" ? installmentsNum : null,
        },
      });
      const expensesPayload = editExpenses
        .map((e) => ({ amount: parseAmount(e.amount), description: e.description.trim() || null }))
        .filter((e) => e.amount > 0);
      await saleService.deleteExpensesBySaleId(selectedSale.id);
      if (expensesPayload.length > 0) {
        await saleService.createExpenses(selectedSale.id, expensesPayload);
      }
      // Si Comisión Crédito pasa a Pagada y hay monto, registrar ingreso (solo ventas con financiamiento)
      const previousCommissionStatus = selectedSale.commission_credit_status ?? "";
      if (
        editPaymentMethod === "financiamiento" &&
        editCommissionCredit.trim() === "pagada" &&
        previousCommissionStatus !== "pagada" &&
        commissionNum != null &&
        !Number.isNaN(commissionNum) &&
        commissionNum > 0
      ) {
        await ingresosEmpresaService.create({
          amount: commissionNum,
          description: "Comisión Crédito",
          etiqueta: "Hessen Motors",
          income_date: format(new Date(), "yyyy-MM-dd"),
          sale_id: selectedSale.id,
          branch_id: selectedSale.branch_id ?? null,
        });
        queryClient.invalidateQueries({ queryKey: ["ingresos-empresa"] });
      }
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
      queryClient.invalidateQueries({ queryKey: ["fund-management"] });
      setDetailEditMode(false);
      setSelectedSale(null);
      toast({
        variant: "success",
        title: "Cambios guardados",
        description: "La venta y sus gastos se han actualizado correctamente.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al actualizar.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleRequestDelete = (sale: SaleWithRelations) => {
    setSaleToDelete(sale);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!saleToDelete) return;
    const idToDelete = saleToDelete.id;
    setDeleteConfirmOpen(false);
    setSelectedSale(null);
    setSaleToDelete(null);
    toast({
      variant: "success",
      title: "Venta eliminada correctamente",
      description: "La venta y sus datos asociados han sido eliminados. La lista se ha actualizado.",
    });
    deleteSale(idToDelete)
      .then(() => queryClient.invalidateQueries({ queryKey: ["fund-management"] }))
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Error al eliminar la venta.";
        toast({ title: "Error al eliminar", description: message, variant: "destructive" });
      });
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const salePrice = parseFloat(formSalePrice.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    const margin = parseFloat(formMargin.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(salePrice) || salePrice < 0) {
      toast({ title: "Error", description: "Monto vendido debe ser un número válido.", variant: "destructive" });
      return;
    }
    if (Number.isNaN(margin) || margin < 0) {
      toast({ title: "Error", description: "Monto ganado debe ser un número válido.", variant: "destructive" });
      return;
    }
    if (!formVendor.trim()) {
      toast({ title: "Error", description: "Selecciona el vendedor.", variant: "destructive" });
      return;
    }
    if (!formVehicleId.trim() && !formVehicleCustom.trim()) {
      toast({ title: "Error", description: "Selecciona un vehículo de la lista o escribe el vehículo vendido.", variant: "destructive" });
      return;
    }
    // Con financiamiento, pie/cuotas/saldoprecio son opcionales (ej. Miami Motors maneja eso aparte)
    if (formPaymentMethod === "financiamiento") {
      if (formDownPayment.trim()) {
        const downPaymentNum = parseFloat(formDownPayment.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
        if (Number.isNaN(downPaymentNum) || downPaymentNum < 0) {
          toast({ title: "Error", description: "Si ingresas pie, debe ser un número válido.", variant: "destructive" });
          return;
        }
        if (downPaymentNum >= salePrice) {
          toast({ title: "Error", description: "El pie debe ser menor al monto vendido.", variant: "destructive" });
          return;
        }
      }
      if (formInstallments.trim()) {
        const installmentsNum = parseInt(formInstallments, 10);
        if (Number.isNaN(installmentsNum) || installmentsNum < 1) {
          toast({ title: "Error", description: "Si ingresas cuotas, debe ser al menos 1.", variant: "destructive" });
          return;
        }
      }
    }
    const downPaymentValue =
      formPaymentMethod === "financiamiento"
        ? parseFloat(formDownPayment.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) || null
        : null;
    const installmentsValue =
      formPaymentMethod === "financiamiento" && formInstallments.trim()
        ? parseInt(formInstallments, 10) || null
        : null;
    const financingAmountValue =
      formPaymentMethod === "financiamiento" && downPaymentValue != null && !Number.isNaN(downPaymentValue)
        ? salePrice - downPaymentValue
        : null;
    const commissionValue =
      formPaymentMethod === "financiamiento" && formCommission.trim()
        ? parseFloat(formCommission.replace(/\s/g, "").replace(/\./g, "").replace(",", "."))
        : null;
    const useCustomVehicle = formVehicleCustom.trim() && !formVehicleId.trim();
    const expensesPayload = formExpenses
      .map((e) => ({ amount: parseAmount(e.amount), description: e.description.trim() || null }))
      .filter((e) => e.amount > 0);
    try {
      await createSale({
        sale: {
          seller_name: formVendor,
          branch_id: branchId ?? undefined,
          stock_origin: formStockOrigin.trim() || null,
          vehicle_id: useCustomVehicle ? null : formVehicleId.trim() || null,
          vehicle_description: useCustomVehicle ? formVehicleCustom.trim() : null,
          client_name: formClientName.trim() || null,
          sale_price: salePrice,
          down_payment: downPaymentValue,
          financing_amount: financingAmountValue,
          installments: installmentsValue,
          commission: Number.isNaN(commissionValue) ? null : commissionValue,
          margin,
          status: "completada",
sale_date: formSaleDate || format(new Date(), "yyyy-MM-dd"),
        payment_method: formPaymentMethod || "contado",
        payment_status: formPaymentStatus || "realizado",
        commission_credit_status: formPaymentMethod === "financiamiento" ? (formCommissionCredit || "pendiente") : null,
        notes: formNotes.trim() || null,
        },
        expenses: expensesPayload.length ? expensesPayload : undefined,
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["fund-management"] });
      setDialogOpen(false);
      toast({
        variant: "success",
        title: "Venta registrada",
        description: useCustomVehicle
          ? "La venta se ha guardado correctamente."
          : "La venta se ha guardado correctamente. El vehículo pasó a estado vendido en el inventario.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al guardar la venta.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ventas</h1>
          <p className="text-muted-foreground mt-1">
            Todas las ventas realizadas y el monto que hemos ganado
          </p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Venta
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total vendido (30 días)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">{stats?.total ?? 0} ventas</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia (30 días)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats?.totalMargin)}</div>
                <p className="text-xs text-muted-foreground">Antes de gastos</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos (30 días)</CardTitle>
            <Minus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats?.totalExpenses ?? 0)}</div>
                <p className="text-xs text-muted-foreground">Bencina, arreglos, etc.</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia neta (30 días)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-700">{formatCurrency(stats?.netMargin ?? 0)}</div>
                <p className="text-xs text-muted-foreground">Después de gastos</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por vendedor, cliente, vehículo o monto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de ventas en tarjetas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Lista de ventas
          </CardTitle>
          <CardDescription>
            Información principal de cada venta registrada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "No hay ventas que coincidan con la búsqueda." : "No hay ventas registradas. Agrega una con el botón Nueva Venta."}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSales.map((sale) => (
                <SaleCard key={sale.id} sale={sale} onClick={() => handleSelectSale(sale)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Detalle de venta (ver / editar) */}
      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && handleCloseDetail()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Detalle de la venta</DialogTitle>
            <DialogDescription>
              {detailEditMode ? "Edita los datos y guarda los cambios." : "Información de la venta. Puedes editar o eliminar."}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            detailEditMode ? (
              <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden flex gap-0">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select value={editVendor} onValueChange={setEditVendor} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENDOR_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monto vendido ($)</Label>
                  <Input
                    type="text"
                    placeholder="Ej: 15000000"
                    value={editSalePrice}
                    onChange={(e) => setEditSalePrice(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monto ganado ($)</Label>
                  <Input
                    type="text"
                    placeholder="Ej: 1200000"
                    value={editMargin}
                    onChange={(e) => setEditMargin(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre del cliente</Label>
                  <Input
                    type="text"
                    placeholder="Ej: Juan Pérez"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado del pago</Label>
                  <Select value={editPaymentStatus || "realizado"} onValueChange={setEditPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de pago</Label>
                  <Select value={editPaymentMethod || "contado"} onValueChange={(v) => setEditPaymentMethod(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(editPaymentMethod || "contado") === "financiamiento" && (
                  <div className="space-y-2">
                    <Label>Comisión Crédito</Label>
                    <Select value={editCommissionCredit || "pendiente"} onValueChange={setEditCommissionCredit}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMISSION_CREDIT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(editPaymentMethod || "contado") === "financiamiento" && (
                  <div className="space-y-2">
                    <Label>Saldoprecio / Comisión ($) (opcional)</Label>
                    <Input
                      type="text"
                      placeholder="Ej: 150000 — anota cuando lo tengas"
                      value={editCommission}
                      onChange={(e) => setEditCommission(e.target.value)}
                    />
                  </div>
                )}
                {(editPaymentMethod || "contado") === "financiamiento" && (
                  <>
                    <div className="space-y-2">
                      <Label>Pie ($) (opcional)</Label>
                      <Input
                        type="text"
                        placeholder="Ej: 5000000"
                        value={editDownPayment}
                        onChange={(e) => setEditDownPayment(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cantidad de cuotas (opcional)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={84}
                        placeholder="Ej: 12, 24..."
                        value={editInstallments}
                        onChange={(e) => setEditInstallments(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Gastos</Label>
                  <p className="text-xs text-muted-foreground">Agrega o edita gastos (bencina, arreglos, etc.). Se restan de la ganancia.</p>
                  <div className="space-y-2">
                    {editExpenses.map((exp) => (
                      <div key={exp.id} className="flex gap-2 items-end">
                        <Input
                          placeholder="Ej: Bencina, arreglo..."
                          value={exp.description}
                          onChange={(e) => updateEditExpense(exp.id, "description", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="text"
                          placeholder="Monto $"
                          value={exp.amount}
                          onChange={(e) => updateEditExpense(exp.id, "amount", e.target.value)}
                          className="w-28"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEditExpense(exp.id)} aria-label="Quitar gasto">
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addEditExpense}>
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar gasto
                    </Button>
                  </div>
                  {(editExpenses.length > 0 || editExpensesTotal > 0) && (
                    <p className="text-sm pt-1">
                      Total gastos: {formatCurrency(editExpensesTotal)}
                      {editMarginNum > 0 && (
                        <span className="text-muted-foreground ml-2">
                          — Ganancia neta: {formatCurrency(editNetMargin)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    placeholder="Detalles adicionales"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                </div>
                <DialogFooter className="shrink-0 border-t pt-4 mt-4">
                  <Button type="button" variant="outline" onClick={() => setDetailEditMode(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Vendedor</p>
                      <p className="font-medium">{selectedSale.seller_name ?? selectedSale.seller?.full_name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fecha</p>
                      <p className="font-medium">
                        {selectedSale.sale_date
                          ? format(new Date(selectedSale.sale_date), "d MMM yyyy", { locale: es })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estado</p>
                      <p className="font-medium">{statusLabels[selectedSale.status ?? "pendiente"]}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monto vendido</p>
                      <p className="font-semibold">{formatCurrency(Number(selectedSale.sale_price))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ganancia</p>
                      <p className="font-semibold text-emerald-600">{formatCurrency(Number(selectedSale.margin))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Forma de pago</p>
                      <p className="font-medium">
                        {selectedSale.payment_method === "financiamiento"
                          ? "Con financiamiento"
                          : selectedSale.payment_method === "contado"
                            ? "Al contado"
                            : selectedSale.payment_method ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estado del pago</p>
                      <span className={`inline-block text-sm font-semibold rounded-md border px-2 py-0.5 ${selectedSale.payment_status === "realizado" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : selectedSale.payment_status === "pendiente" ? "bg-red-100 text-red-800 border-red-200" : "bg-muted text-muted-foreground border-border"}`}>
                        {selectedSale.payment_status === "realizado"
                          ? "Pago realizado"
                          : selectedSale.payment_status === "pendiente"
                            ? "Pago pendiente"
                            : selectedSale.payment_status ?? "—"}
                      </span>
                    </div>
                    {selectedSale.payment_method === "financiamiento" && (
                      <div>
                        <p className="text-muted-foreground">Comisión Crédito</p>
                        <span className={`inline-block text-sm font-semibold rounded-md border px-2 py-0.5 ${(selectedSale.commission_credit_status ?? "pendiente") === "pagada" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-red-100 text-red-800 border-red-200"}`}>
                          {(selectedSale.commission_credit_status ?? "pendiente") === "pagada" ? "Comisión Crédito: Pagada" : "Comisión Crédito: Pendiente"}
                        </span>
                      </div>
                    )}
                    {selectedSale.stock_origin && (
                      <div>
                        <p className="text-muted-foreground">Origen Stock</p>
                        <p className="font-medium">
                          {selectedSale.stock_origin === "HESSENMOTORS" ? "HessenMotors" : selectedSale.stock_origin === "MIAMIMOTORS" ? "Miami Motors" : selectedSale.stock_origin}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedSale.payment_method === "financiamiento" && (selectedSale.down_payment != null || selectedSale.installments != null) && (
                    <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                      {selectedSale.down_payment != null && (
                        <div>
                          <p className="text-muted-foreground">Pie</p>
                          <p className="font-medium">{formatCurrency(Number(selectedSale.down_payment))}</p>
                        </div>
                      )}
                      {selectedSale.installments != null && (
                        <div>
                          <p className="text-muted-foreground">Cuotas</p>
                          <p className="font-medium">{selectedSale.installments}</p>
                        </div>
                      )}
                      {selectedSale.financing_amount != null && (
                        <div>
                          <p className="text-muted-foreground">Monto financiado</p>
                          <p className="font-medium">{formatCurrency(Number(selectedSale.financing_amount))}</p>
                        </div>
                      )}
                      {selectedSale.commission != null && (
                        <div>
                          <p className="text-muted-foreground">Saldoprecio / Comisión</p>
                          <p className="font-medium">{formatCurrency(Number(selectedSale.commission))}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(selectedSale.client_name || selectedSale.lead?.full_name) && (
                    <div>
                      <p className="text-muted-foreground text-sm">Cliente</p>
                      <p className="font-medium">{selectedSale.client_name || selectedSale.lead?.full_name}</p>
                      {selectedSale.lead?.phone && <p className="text-sm text-muted-foreground">{selectedSale.lead.phone}</p>}
                    </div>
                  )}
                  {(selectedSale.vehicle || selectedSale.vehicle_description) && (
                    <div>
                      <p className="text-muted-foreground text-sm">Vehículo</p>
                      <p className="font-medium">
                        {selectedSale.vehicle
                          ? `${selectedSale.vehicle.make} ${selectedSale.vehicle.model} ${selectedSale.vehicle.year}`
                          : selectedSale.vehicle_description}
                      </p>
                    </div>
                  )}
                  {selectedSale.sale_expenses && selectedSale.sale_expenses.length > 0 && (
                    <div>
                      <p className="text-muted-foreground text-sm">Gastos</p>
                      <ul className="text-sm space-y-1">
                        {selectedSale.sale_expenses.map((ex) => (
                          <li key={ex.id} className="flex justify-between gap-2">
                            <span>{ex.description || "Sin descripción"}</span>
                            <span>{formatCurrency(Number(ex.amount))}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm font-medium mt-1">
                        Total gastos: {formatCurrency(selectedSale.sale_expenses.reduce((s, e) => s + Number(e.amount), 0))}
                        {selectedSale.margin != null && (
                          <span className="text-muted-foreground ml-2">
                            — Ganancia neta: {formatCurrency(Number(selectedSale.margin) - selectedSale.sale_expenses.reduce((s, e) => s + Number(e.amount), 0))}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedSale.notes && (
                    <div>
                      <p className="text-muted-foreground text-sm">Notas</p>
                      <p className="text-sm">{selectedSale.notes}</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="shrink-0 border-t pt-4 gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={() => handleCloseDetail()}>
                    Cerrar
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDetailEditMode(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleRequestDelete(selectedSale)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </DialogFooter>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminar */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la venta y sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSaleToDelete(null)}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Nueva Venta */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && location.search) {
            navigate(location.pathname, { replace: true });
          }
        }}
      >
        <DialogContent
          ref={(el) => {
            newSaleDialogRef.current = el;
            setNewSaleDialogEl(el ?? null);
          }}
          className={`sm:max-w-md max-h-[90vh] flex flex-col ${vehiclePopoverOpen ? "overflow-visible" : "overflow-hidden"}`}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Nueva venta</DialogTitle>
            <DialogDescription>
              Registra el vehículo vendido, monto, ganancia, fecha y forma de pago.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitSale} className="flex flex-col min-h-0 flex-1 overflow-hidden flex gap-4">
            <div
              className={`min-h-0 flex-1 space-y-4 pr-1 ${vehiclePopoverOpen ? "overflow-hidden" : "overflow-y-auto"}`}
            >
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendedor</Label>
              <Select value={formVendor} onValueChange={setFormVendor} required>
                <SelectTrigger id="vendor">
                  <SelectValue placeholder="Seleccionar vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock_origin">Origen Stock</Label>
              <Select value={formStockOrigin} onValueChange={setFormStockOrigin}>
                <SelectTrigger id="stock_origin">
                  <SelectValue placeholder="Seleccionar origen" />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_ORIGIN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehículo vendido</Label>
              <Popover open={vehiclePopoverOpen} onOpenChange={setVehiclePopoverOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button
                    id="vehicle"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={vehiclePopoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    {formVehicleId
                      ? (() => {
                          const v = vehicles.find((x) => x.id === formVehicleId);
                          return v ? `${v.make} ${v.model} ${v.year} — ${formatCurrency(v.price)}` : "Seleccionar vehículo";
                        })()
                      : formVehicleCustom.trim()
                        ? formVehicleCustom.trim()
                        : "Seleccionar vehículo"}
                    <span className="ml-2 shrink-0 opacity-50">▼</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                  container={newSaleDialogEl}
                >
                  <Command shouldFilter={true}>
                    <CommandInput placeholder="Buscar por marca, modelo, año..." />
                    <CommandList
                      className="vehicle-list-scroll max-h-[280px] overflow-y-auto overflow-x-hidden overscroll-contain pr-3"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <CommandEmpty>Ningún vehículo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {vehicles.map((v) => (
                          <CommandItem
                            key={v.id}
                            value={`${v.make} ${v.model} ${v.year} ${v.vin ?? ""} ${v.price}`}
                            onSelect={() => {
                              setFormVehicleId(v.id);
                              setFormVehicleCustom("");
                              if (v.price != null) setFormSalePrice(String(v.price));
                              setVehiclePopoverOpen(false);
                            }}
                          >
                            <Car className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                            <span className="min-w-0 flex-1 truncate pr-1">{v.make} {v.model} {v.year} — {formatCurrency(v.price)}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Escribe para filtrar. Aparecen todos los vehículos del inventario. Al guardar la venta, el vehículo seleccionado pasará a estado &quot;vendido&quot; automáticamente.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_custom">O escribe el vehículo (si no está en la lista)</Label>
              <Input
                id="vehicle_custom"
                type="text"
                placeholder="Ej: Toyota Corolla 2020, Nissan Kicks 2022..."
                value={formVehicleCustom}
                onChange={(e) => {
                  setFormVehicleCustom(e.target.value);
                  if (e.target.value.trim()) setFormVehicleId("");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_name">Nombre del cliente</Label>
              <Input
                id="client_name"
                type="text"
                placeholder="Ej: Juan Pérez"
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_date">Fecha de la venta</Label>
              <Input
                id="sale_date"
                type="date"
                value={formSaleDate}
                onChange={(e) => setFormSaleDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de pago</Label>
              <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod} required>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado del pago</Label>
              <Select value={formPaymentStatus} onValueChange={setFormPaymentStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formPaymentMethod === "financiamiento" && (
              <>
                <div className="space-y-2">
                  <Label>Comisión Crédito</Label>
                  <Select value={formCommissionCredit} onValueChange={setFormCommissionCredit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMISSION_CREDIT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="down_payment">Pie ($) (opcional)</Label>
                  <Input
                    id="down_payment"
                    type="text"
                    placeholder="Ej: 5000000 — opcional"
                    value={formDownPayment}
                    onChange={(e) => setFormDownPayment(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installments">Cantidad de cuotas (opcional)</Label>
                  <Input
                    id="installments"
                    type="number"
                    min={1}
                    max={84}
                    placeholder="Ej: 12, 24, 36... — opcional"
                    value={formInstallments}
                    onChange={(e) => setFormInstallments(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission">Saldoprecio / Comisión (opcional)</Label>
                  <Input
                    id="commission"
                    type="text"
                    placeholder="Ej: 150000 — puedes anotarlo después"
                    value={formCommission}
                    onChange={(e) => setFormCommission(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="sale_price">Monto vendido ($)</Label>
              <Input
                id="sale_price"
                type="text"
                placeholder="Ej: 15000000"
                value={formSalePrice}
                onChange={(e) => setFormSalePrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="margin">Monto ganado ($)</Label>
              <Input
                id="margin"
                type="text"
                placeholder="Ej: 1200000"
                value={formMargin}
                onChange={(e) => setFormMargin(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Gastos</Label>
              <p className="text-xs text-muted-foreground">Bencina, arreglos u otros gastos de la venta. Se restan de la ganancia.</p>
              <div className="space-y-2">
                {formExpenses.map((exp) => (
                  <div key={exp.id} className="flex gap-2 items-end">
                    <Input
                      placeholder="Ej: Bencina, arreglo..."
                      value={exp.description}
                      onChange={(e) => updateFormExpense(exp.id, "description", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      placeholder="Monto $"
                      value={exp.amount}
                      onChange={(e) => updateFormExpense(exp.id, "amount", e.target.value)}
                      className="w-28"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFormExpense(exp.id)} aria-label="Quitar gasto">
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addFormExpense}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar gasto
                </Button>
              </div>
              {(formExpenses.length > 0 || formExpensesTotal > 0) && (
                <p className="text-sm pt-1">
                  Total gastos: {formatCurrency(formExpensesTotal)}
                  {formMarginNum > 0 && (
                    <span className="text-muted-foreground ml-2">
                      — Ganancia neta: {formatCurrency(formNetMargin)}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Detalles adicionales"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
            </div>
            <DialogFooter className="shrink-0 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar venta"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaleCard({ sale, onClick }: { sale: SaleWithRelations; onClick: () => void }) {
  const status = sale.status ?? "pendiente";
  const saleDate = sale.sale_date
    ? format(new Date(sale.sale_date), "d MMM yyyy", { locale: es })
    : "";
  const vehicleLabel = sale.vehicle
    ? `${sale.vehicle.make} ${sale.vehicle.model} ${sale.vehicle.year}`
    : sale.vehicle_description ?? "Sin vehículo";

  return (
    <Card
      className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Car className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{vehicleLabel}</CardTitle>
              <CardDescription className="text-xs">{saleDate}</CardDescription>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? statusStyles.pendiente}`}>
            {statusLabels[status] ?? status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Monto vendido</span>
          <span className="font-semibold">{formatCurrency(Number(sale.sale_price))}</span>
        </div>
        {sale.sale_expenses && sale.sale_expenses.length > 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ganancia neta</span>
            <span className="font-semibold text-emerald-600">
              {formatCurrency(Number(sale.margin) - sale.sale_expenses.reduce((s, e) => s + Number(e.amount), 0))}
            </span>
          </div>
        ) : (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ganancia</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(Number(sale.margin))}</span>
          </div>
        )}
        {sale.sale_expenses && sale.sale_expenses.length > 0 && (
          <p className="text-xs text-muted-foreground">Gastos: {formatCurrency(sale.sale_expenses.reduce((s, e) => s + Number(e.amount), 0))}</p>
        )}
        <p className="text-xs text-muted-foreground truncate">
          Vendedor: {sale.seller_name ?? sale.seller?.full_name ?? "—"}
        </p>
        {(sale.client_name || sale.lead?.full_name) && (
          <p className="text-xs text-muted-foreground truncate">Cliente: {sale.client_name || sale.lead?.full_name}</p>
        )}
        {sale.stock_origin && (
          <p className="text-xs text-muted-foreground truncate">
            Origen: {sale.stock_origin === "HESSENMOTORS" ? "HessenMotors" : sale.stock_origin === "MIAMIMOTORS" ? "Miami Motors" : sale.stock_origin}
          </p>
        )}
        <div className="flex flex-col gap-1">
        {sale.payment_status && (
          <span className={`inline-block w-fit text-xs font-semibold rounded-md border px-2 py-0.5 ${sale.payment_status === "realizado" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : sale.payment_status === "pendiente" ? "bg-red-100 text-red-800 border-red-200" : "bg-muted text-muted-foreground border-border"}`}>
            {sale.payment_status === "realizado" ? "Pago realizado" : sale.payment_status === "pendiente" ? "Pago pendiente" : sale.payment_status}
          </span>
        )}
        {sale.payment_method === "financiamiento" && (
          <span className={`inline-block w-fit text-xs font-semibold rounded-md border px-2 py-0.5 ${(sale.commission_credit_status ?? "pendiente") === "pagada" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-red-100 text-red-800 border-red-200"}`}>
            {(sale.commission_credit_status ?? "pendiente") === "pagada" ? "Comisión Crédito: Pagada" : "Comisión Crédito: Pendiente"}
          </span>
        )}
      </div>
      </CardContent>
    </Card>
  );
}
