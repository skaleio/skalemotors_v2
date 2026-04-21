import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Search, Trash2, User, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

type StaffSaleRecord = {
  id: string;
  sale_date: string;
  client_name: string | null;
  vehicle_description: string | null;
  sale_price: number;
  payment_method: string | null;
  payment_status: string | null;
  commission: number | null;
  lead_full_name: string | null;
};

type Seller = {
  id: string;
  name: string;
  role: string;
  branch: string;
  status: "Activo" | "Inactivo";
};

type StaffRow = Database["public"]["Tables"]["branch_sales_staff"]["Row"] & {
  branch?: { name: string } | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

const STAFF_ROLES_MANAGE = new Set(["admin", "jefe_jefe", "gerente", "jefe_sucursal"]);

const USERS_PAGE_ROLES = new Set(["admin", "jefe_jefe", "gerente", "jefe_sucursal"]);

const DEFAULT_SELLER_ROLE = "Vendedor";

const SELLER_ROLE_OPTIONS = [
  "Vendedor",
  "Vendedora",
  "Asesor comercial",
  "Asesora comercial",
  "Vendedor senior",
  "Jefe de ventas",
  "Subgerente comercial",
  "Trainee / practicante",
] as const;

export default function VendorManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManageStaff = user?.role ? STAFF_ROLES_MANAGE.has(user.role) : false;
  const canOpenUsersPage = user?.role ? USERS_PAGE_ROLES.has(user.role) : false;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>(DEFAULT_SELLER_ROLE);

  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ["branch_sales_staff", user?.tenant_id, user?.branch_id],
    enabled: !!user?.tenant_id,
    queryFn: async () => {
      let q = supabase
        .from("branch_sales_staff")
        .select("*, branch:branches(name)")
        .eq("tenant_id", user!.tenant_id!)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      if (user!.branch_id) {
        q = q.or(`branch_id.eq.${user.branch_id},branch_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as StaffRow[];
    },
  });

  const sellers: Seller[] = useMemo(() => {
    return staffList.map((row) => ({
      id: row.id,
      name: row.full_name,
      role: row.role_label || "Vendedor",
      branch: row.branch?.name || (row.branch_id ? "Sucursal" : "Todas las sucursales"),
      status: row.is_active ? "Activo" : "Inactivo",
    }));
  }, [staffList]);

  const { data: staffSales = [], isLoading: loadingStaffSales } = useQuery({
    queryKey: ["staff_sales", selectedSeller?.id, user?.tenant_id],
    enabled: detailOpen && !!selectedSeller?.id && !!user?.tenant_id,
    queryFn: async (): Promise<StaffSaleRecord[]> => {
      const { data: leadRows, error: leadErr } = await supabase
        .from("leads")
        .select("id, full_name")
        .eq("closed_by_staff_id", selectedSeller!.id)
        .eq("tenant_id", user!.tenant_id!);
      if (leadErr) throw leadErr;

      const leads = leadRows ?? [];
      if (leads.length === 0) return [];

      const leadIds = leads.map((l) => l.id);
      const leadNameById = new Map(leads.map((l) => [l.id, l.full_name as string | null]));

      const { data: saleRows, error: saleErr } = await supabase
        .from("sales")
        .select(
          "id, sale_date, client_name, vehicle_description, sale_price, payment_method, payment_status, commission, lead_id",
        )
        .in("lead_id", leadIds)
        .order("sale_date", { ascending: false });
      if (saleErr) throw saleErr;

      return (saleRows ?? []).map((s) => ({
        id: s.id,
        sale_date: s.sale_date,
        client_name: s.client_name,
        vehicle_description: s.vehicle_description,
        sale_price: Number(s.sale_price ?? 0),
        payment_method: s.payment_method,
        payment_status: s.payment_status,
        commission: s.commission == null ? null : Number(s.commission),
        lead_full_name: s.lead_id ? leadNameById.get(s.lead_id) ?? null : null,
      }));
    },
  });

  const salesSummary = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    const inThisMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    };
    const monthSales = staffSales.filter((s) => inThisMonth(s.sale_date));
    const totalAmountMonth = monthSales.reduce((sum, s) => sum + s.sale_price, 0);
    const commissionMonth = monthSales.reduce((sum, s) => sum + (s.commission ?? 0), 0);
    const commissionPaidMonth = monthSales
      .filter((s) => s.payment_status === "realizado")
      .reduce((sum, s) => sum + (s.commission ?? 0), 0);
    return {
      totalSales: staffSales.length,
      salesThisMonth: monthSales.length,
      totalAmountMonth,
      commissionMonth,
      commissionPaidMonth,
    };
  }, [staffSales]);

  const createMutation = useMutation({
    mutationFn: async (payload: Database["public"]["Tables"]["branch_sales_staff"]["Insert"]) => {
      const { error } = await supabase.from("branch_sales_staff").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["branch_sales_staff"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("branch_sales_staff")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["branch_sales_staff"] });
    },
  });

  const filteredSellers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return sellers;
    return sellers.filter((seller) =>
      `${seller.name} ${seller.branch} ${seller.role}`.toLowerCase().includes(query),
    );
  }, [searchQuery, sellers]);

  const handleOpenDetail = (seller: Seller) => {
    setSelectedSeller(seller);
    setDetailOpen(true);
  };

  // Totales por staff del mes en curso (una sola query, agrupado en cliente).
  const { data: staffMonthTotals = new Map<string, { salesCount: number; totalAmount: number; totalCommission: number }>() } =
    useQuery({
      queryKey: ["staff_sales_month_totals", user?.tenant_id],
      enabled: !!user?.tenant_id && sellers.length > 0,
      queryFn: async () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from("sales")
          .select("sale_price, commission, sale_date, lead:leads!inner(closed_by_staff_id)")
          .eq("tenant_id", user!.tenant_id!)
          .gte("sale_date", firstDay);
        if (error) throw error;

        type Row = {
          sale_price: number | null;
          commission: number | null;
          lead: { closed_by_staff_id: string | null } | { closed_by_staff_id: string | null }[] | null;
        };
        const map = new Map<string, { salesCount: number; totalAmount: number; totalCommission: number }>();
        for (const row of (data ?? []) as Row[]) {
          const leadObj = Array.isArray(row.lead) ? row.lead[0] : row.lead;
          const staffId = leadObj?.closed_by_staff_id ?? null;
          if (!staffId) continue;
          const prev = map.get(staffId) ?? { salesCount: 0, totalAmount: 0, totalCommission: 0 };
          prev.salesCount += 1;
          prev.totalAmount += Number(row.sale_price ?? 0);
          prev.totalCommission += Number(row.commission ?? 0);
          map.set(staffId, prev);
        }
        return map;
      },
    });

  const totalCommissions = useMemo(() => {
    let total = 0;
    for (const entry of staffMonthTotals.values()) total += entry.totalCommission;
    return total;
  }, [staffMonthTotals]);

  const totalSalesAmountMonth = useMemo(() => {
    let total = 0;
    for (const entry of staffMonthTotals.values()) total += entry.totalAmount;
    return total;
  }, [staffMonthTotals]);

  const handleDeleteSeller = (id: string) => {
    if (!canManageStaff) {
      toast({
        title: "Sin permiso",
        description: "Solo administración o gerencia pueden dar de baja vendedores.",
        variant: "destructive",
      });
      return;
    }
    deactivateMutation.mutate(id, {
      onSuccess: () => {
        if (selectedSeller?.id === id) {
          setSelectedSeller(null);
          setDetailOpen(false);
        }
        toast({ title: "Vendedor desactivado", description: "Ya no aparecerá en listas activas ni en el CRM." });
      },
      onError: (err) => {
        toast({
          title: "No se pudo desactivar",
          description: err instanceof Error ? err.message : "Intenta de nuevo.",
          variant: "destructive",
        });
      },
    });
  };

  const handleCreateSeller = (event: FormEvent) => {
    event.preventDefault();
    if (!user?.tenant_id) {
      toast({
        title: "Falta el espacio de trabajo",
        description: "Tu usuario no tiene tenant asignado. Completa onboarding o contacta soporte.",
        variant: "destructive",
      });
      return;
    }
    if (!canManageStaff) {
      toast({
        title: "Sin permiso",
        description: "Solo administración o gerencia pueden crear vendedores aquí.",
        variant: "destructive",
      });
      return;
    }
    if (!newName.trim()) {
      return;
    }

    createMutation.mutate(
      {
        tenant_id: user.tenant_id,
        branch_id: user.branch_id ?? null,
        full_name: newName.trim(),
        role_label: newRole.trim() || DEFAULT_SELLER_ROLE,
        base_salary_clp: 0,
        is_active: true,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewName("");
          setNewRole(DEFAULT_SELLER_ROLE);
          toast({
            title: "Vendedor creado",
            description: "Aparecerá en el formulario «Cerrar negocio» del CRM en esta sucursal.",
          });
        },
        onError: (err) => {
          toast({
            title: "No se pudo guardar",
            description: err instanceof Error ? err.message : "Revisa permisos o intenta de nuevo.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendedores</h1>
          <p className="mt-2 text-muted-foreground">
            Administra tu equipo comercial. Los vendedores que agregues aquí se ofrecen al cerrar un negocio
            en el CRM.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canOpenUsersPage ? (
            <Button variant="outline" asChild>
              <Link to="/app/users">Accesos CRM (correo y contraseña)</Link>
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setNewName("");
              setNewRole(DEFAULT_SELLER_ROLE);
              setCreateOpen(true);
            }}
            disabled={!user?.tenant_id || !canManageStaff}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Vendedor
          </Button>
        </div>
      </div>

      {/* Resumen global */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              Equipo activo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{loadingStaff ? "…" : sellers.length}</p>
            <p className="text-xs text-muted-foreground">
              Plantilla para cerrar negocios. Las cuentas con login al CRM se crean en Usuarios.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-primary" />
              Ventas del mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalSalesAmountMonth)}</p>
            <p className="text-xs text-muted-foreground">
              Monto total vendido en el mes en curso por la plantilla.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-primary" />
              Comisiones del mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalCommissions)}</p>
            <p className="text-xs text-muted-foreground">
              Calculado desde las ventas registradas con comisión.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar vendedores por nombre, sucursal o rol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cuadros por vendedor */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredSellers.map((seller) => {
          const totals = staffMonthTotals.get(seller.id);
          const salesCount = totals?.salesCount ?? 0;
          const totalAmount = totals?.totalAmount ?? 0;
          const totalCommission = totals?.totalCommission ?? 0;
          return (
            <Card
              key={seller.id}
              className="group cursor-pointer border-muted hover:border-primary/40 hover:shadow-md transition-all"
              onClick={() => handleOpenDetail(seller)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">{seller.name}</CardTitle>
                    <CardDescription>{seller.role}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={seller.status === "Activo" ? "default" : "outline"}>
                    {seller.status}
                  </Badge>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteSeller(seller.id);
                    }}
                    aria-label="Eliminar vendedor"
                    disabled={!canManageStaff || deactivateMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sucursal</span>
                  <span className="font-medium">{seller.branch}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ventas mes</p>
                    <p className="font-semibold">{salesCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Monto mes</p>
                    <p className="font-semibold">{formatCurrency(totalAmount)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Comisión mes</p>
                    <p className="font-semibold text-emerald-600">
                      {formatCurrency(totalCommission)}
                    </p>
                  </div>
                </div>
                <p className="pt-1 text-xs text-primary group-hover:underline">
                  Ver detalle de ventas
                </p>
              </CardContent>
            </Card>
          );
        })}

        {!loadingStaff && filteredSellers.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No se encontraron vendedores para el criterio de búsqueda.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detalle de vendedor */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedSeller(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          {selectedSeller && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <span>{selectedSeller.name}</span>
                    <p className="text-xs font-normal text-muted-foreground">
                      {selectedSeller.role} · {selectedSeller.branch}
                    </p>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  Resumen de ventas cerradas por este vendedor y sus comisiones.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Ventas del mes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold">{salesSummary.salesThisMonth}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Monto vendido mes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold">
                        {formatCurrency(salesSummary.totalAmountMonth)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Comisiones del mes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold">
                        {formatCurrency(salesSummary.commissionMonth)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Pagado este mes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold">
                        {formatCurrency(salesSummary.commissionPaidMonth)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Historial de ventas</h3>
                    <span className="text-xs text-muted-foreground">
                      {loadingStaffSales ? "Cargando…" : `${staffSales.length} ventas`}
                    </span>
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Vehículo</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead className="text-right">Comisión</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingStaffSales ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                              Cargando ventas…
                            </TableCell>
                          </TableRow>
                        ) : staffSales.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                              Sin ventas registradas para este vendedor.
                            </TableCell>
                          </TableRow>
                        ) : (
                          staffSales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell className="whitespace-nowrap text-xs">
                                {new Date(sale.sale_date).toLocaleDateString("es-CL")}
                              </TableCell>
                              <TableCell className="text-xs">
                                {sale.vehicle_description || "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {sale.client_name || sale.lead_full_name || "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs capitalize">
                                {sale.payment_method || "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs font-semibold text-right">
                                {formatCurrency(sale.sale_price)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-right">
                                {sale.commission != null ? formatCurrency(sale.commission) : "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Crear nuevo vendedor */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) {
            setNewName("");
            setNewRole(DEFAULT_SELLER_ROLE);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Vendedor</DialogTitle>
            <DialogDescription>
              Se guarda en tu espacio de trabajo y queda disponible al cerrar negocio en el CRM (misma
              sucursal que tu usuario, si aplica).
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4 pt-2" onSubmit={handleCreateSeller}>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                placeholder="Ej: Juan Pérez"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Cargo / rol</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {SELLER_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !canManageStaff}>
                {createMutation.isPending ? "Guardando…" : "Guardar vendedor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
