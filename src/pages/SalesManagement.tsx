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
import { toast } from "@/hooks/use-toast";
import { vehicleService } from "@/lib/services/vehicles";
import {
  Calendar,
  Car,
  DollarSign,
  Loader2,
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
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const VENDOR_OPTIONS = [
  { value: "HESSENMOTORS", label: "HESSENMOTORS" },
  { value: "MIAMIMOTORS", label: "MIAMIMOTORS" },
] as const;

const PAYMENT_OPTIONS = [
  { value: "contado", label: "Al contado" },
  { value: "financiamiento", label: "Con financiamiento" },
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
  const [formVehicleId, setFormVehicleId] = useState<string>("");
  const [formSalePrice, setFormSalePrice] = useState("");
  const [formMargin, setFormMargin] = useState("");
  const [formSaleDate, setFormSaleDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("contado");
  const [formDownPayment, setFormDownPayment] = useState("");
  const [formInstallments, setFormInstallments] = useState("");
  const [formCommission, setFormCommission] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [vehiclePopoverOpen, setVehiclePopoverOpen] = useState(false);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles-for-sale", branchId],
    queryFn: () => vehicleService.getAll({ branchId: branchId ?? undefined, status: "disponible" }),
    enabled: dialogOpen,
  });

  const [selectedSale, setSelectedSale] = useState<SaleWithRelations | null>(null);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [editVendor, setEditVendor] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editMargin, setEditMargin] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<SaleWithRelations | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") !== "true") return;
    setFormVendor("");
    setFormVehicleId("");
    setFormSalePrice("");
    setFormMargin("");
    setFormSaleDate(format(new Date(), "yyyy-MM-dd"));
    setFormPaymentMethod("contado");
    setFormDownPayment("");
    setFormInstallments("");
    setFormCommission("");
    setFormClientName("");
    setFormNotes("");
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
        : "";
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
    setFormVehicleId("");
    setFormSalePrice("");
    setFormMargin("");
    setFormSaleDate(format(new Date(), "yyyy-MM-dd"));
    setFormPaymentMethod("contado");
    setFormDownPayment("");
    setFormInstallments("");
    setFormCommission("");
    setFormClientName("");
    setFormNotes("");
    setVehiclePopoverOpen(false);
    setDialogOpen(true);
  };

  const handleSelectSale = (sale: SaleWithRelations) => {
    setSelectedSale(sale);
    setDetailEditMode(false);
    setEditVendor(sale.seller_name ?? "");
    setEditSalePrice(String(sale.sale_price ?? ""));
    setEditMargin(String(sale.margin ?? ""));
    setEditNotes(sale.notes ?? "");
  };

  const handleCloseDetail = () => {
    setSelectedSale(null);
    setDetailEditMode(false);
  };

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
      await updateSale({
        id: selectedSale.id,
        updates: {
          seller_name: editVendor,
          sale_price: salePrice,
          margin,
          notes: editNotes.trim() || null,
        },
      });
      await refetch();
      setDetailEditMode(false);
      setSelectedSale(null);
      toast({
        variant: "success",
        title: "Cambios guardados",
        description: "La venta se ha actualizado correctamente. La lista se ha actualizado.",
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
    deleteSale(idToDelete).catch((err) => {
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
    if (!formVehicleId.trim()) {
      toast({ title: "Error", description: "Debes seleccionar el vehículo que se vendió.", variant: "destructive" });
      return;
    }
    if (formPaymentMethod === "financiamiento") {
      const downPaymentNum = parseFloat(formDownPayment.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
      const installmentsNum = parseInt(formInstallments, 10);
      if (Number.isNaN(downPaymentNum) || downPaymentNum < 0) {
        toast({ title: "Error", description: "Ingresa un pie válido.", variant: "destructive" });
        return;
      }
      if (Number.isNaN(installmentsNum) || installmentsNum < 1) {
        toast({ title: "Error", description: "Ingresa la cantidad de cuotas (mínimo 1).", variant: "destructive" });
        return;
      }
      if (downPaymentNum >= salePrice) {
        toast({ title: "Error", description: "El pie debe ser menor al monto vendido.", variant: "destructive" });
        return;
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
    try {
      await createSale({
        seller_name: formVendor,
        branch_id: branchId ?? undefined,
        vehicle_id: formVehicleId.trim(),
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
        notes: formNotes.trim() || null,
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["vehicles-for-sale"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setDialogOpen(false);
      toast({
        variant: "success",
        title: "Venta registrada",
        description: "La venta se ha guardado correctamente. El vehículo pasó a estado vendido en el inventario.",
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
      <div className="grid gap-4 md:grid-cols-3">
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
                <p className="text-xs text-muted-foreground">Margen total</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas completadas</CardTitle>
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
                <div className="text-2xl font-bold">{stats?.completed ?? 0}</div>
                <p className="text-xs text-muted-foreground">Últimos 30 días</p>
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de la venta</DialogTitle>
            <DialogDescription>
              {detailEditMode ? "Edita los datos y guarda los cambios." : "Información de la venta. Puedes editar o eliminar."}
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            detailEditMode ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
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
                  <Label>Notas (opcional)</Label>
                  <Textarea
                    placeholder="Detalles adicionales"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <DialogFooter>
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
              <>
                <div className="space-y-4">
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
                  {selectedSale.vehicle && (
                    <div>
                      <p className="text-muted-foreground text-sm">Vehículo</p>
                      <p className="font-medium">{selectedSale.vehicle.make} {selectedSale.vehicle.model} {selectedSale.vehicle.year}</p>
                    </div>
                  )}
                  {selectedSale.notes && (
                    <div>
                      <p className="text-muted-foreground text-sm">Notas</p>
                      <p className="text-sm">{selectedSale.notes}</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
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
              </>
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
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nueva venta</DialogTitle>
            <DialogDescription>
              Registra el vehículo vendido, monto, ganancia, fecha y forma de pago.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitSale} className="flex flex-col min-h-0 flex-1 overflow-hidden flex gap-4">
            <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
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
              <Label htmlFor="vehicle">Vehículo vendido</Label>
              <Popover open={vehiclePopoverOpen} onOpenChange={setVehiclePopoverOpen}>
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
                      : "Seleccionar vehículo"}
                    <span className="ml-2 shrink-0 opacity-50">▼</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={true}>
                    <CommandInput placeholder="Buscar por marca, modelo, año..." />
                    <CommandList className="max-h-[280px] overflow-y-auto">
                      <CommandEmpty>Ningún vehículo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {vehicles.map((v) => (
                          <CommandItem
                            key={v.id}
                            value={`${v.make} ${v.model} ${v.year} ${v.vin ?? ""} ${v.price}`}
                            onSelect={() => {
                              setFormVehicleId(v.id);
                              if (v.price != null) setFormSalePrice(String(v.price));
                              setVehiclePopoverOpen(false);
                            }}
                          >
                            <Car className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                            <span className="truncate">{v.make} {v.model} {v.year} — {formatCurrency(v.price)}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Escribe para filtrar. Solo vehículos disponibles. Al guardar la venta, el vehículo pasará a estado &quot;vendido&quot; en el inventario.</p>
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
            {formPaymentMethod === "financiamiento" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="down_payment">Pie ($)</Label>
                  <Input
                    id="down_payment"
                    type="text"
                    placeholder="Ej: 5000000"
                    value={formDownPayment}
                    onChange={(e) => setFormDownPayment(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installments">Cantidad de cuotas</Label>
                  <Input
                    id="installments"
                    type="number"
                    min={1}
                    max={84}
                    placeholder="Ej: 12, 24, 36..."
                    value={formInstallments}
                    onChange={(e) => setFormInstallments(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission">Saldoprecio / Comisión (venta a crédito) ($)</Label>
                  <Input
                    id="commission"
                    type="text"
                    placeholder="Ej: 150000"
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
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{sale.seller_name ?? sale.seller?.full_name ?? "Sin asignar"}</CardTitle>
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
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Ganancia</span>
          <span className="font-semibold text-emerald-600">{formatCurrency(Number(sale.margin))}</span>
        </div>
        {sale.vehicle && (
          <p className="text-xs text-muted-foreground truncate">
            {sale.vehicle.make} {sale.vehicle.model} {sale.vehicle.year}
          </p>
        )}
        {(sale.client_name || sale.lead?.full_name) && (
          <p className="text-xs text-muted-foreground truncate">Cliente: {sale.client_name || sale.lead?.full_name}</p>
        )}
      </CardContent>
    </Card>
  );
}
