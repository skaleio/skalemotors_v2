import { FormEvent, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type PaymentRecord = {
  id: string;
  date: string;
  concept: string;
  type: "Salario fijo" | "Comisión";
  saleCode?: string;
  amount: number;
  status: "Pagado" | "Pendiente";
};

type Seller = {
  id: string;
  name: string;
  role: string;
  branch: string;
  baseSalary: number;
  totalCommissionMonth: number;
  totalPaidMonth: number;
  status: "Activo" | "Inactivo";
  payments: PaymentRecord[];
};

const initialSellers: Seller[] = [];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function VendorManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newBaseSalary, setNewBaseSalary] = useState("");

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

  const totalFixed = useMemo(
    () => sellers.reduce((sum, s) => sum + s.baseSalary, 0),
    [sellers],
  );
  const totalCommissions = useMemo(
    () => sellers.reduce((sum, s) => sum + s.totalCommissionMonth, 0),
    [sellers],
  );

  const handleDeleteSeller = (id: string) => {
    setSellers((prev) => prev.filter((seller) => seller.id !== id));
    if (selectedSeller?.id === id) {
      setSelectedSeller(null);
      setDetailOpen(false);
    }
  };

  const handleCreateSeller = (event: FormEvent) => {
    event.preventDefault();
    const baseSalaryNumber = Number(newBaseSalary.replace(/\./g, "").replace(/,/g, ""));
    if (!newName.trim() || !newBranch.trim() || Number.isNaN(baseSalaryNumber)) {
      return;
    }

    const newSeller: Seller = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      role: newRole.trim() || "Vendedor",
      branch: newBranch.trim(),
      baseSalary: baseSalaryNumber,
      totalCommissionMonth: 0,
      totalPaidMonth: 0,
      status: "Activo",
      payments: [],
    };

    setSellers((prev) => [...prev, newSeller]);
    setCreateOpen(false);
    setNewName("");
    setNewRole("");
    setNewBranch("");
    setNewBaseSalary("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendedores</h1>
          <p className="mt-2 text-muted-foreground">
            Administra tu equipo comercial, sus salarios fijos y comisiones de venta.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Vendedor
        </Button>
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
            <p className="text-2xl font-bold">{sellers.length}</p>
            <p className="text-xs text-muted-foreground">
              Total de vendedores registrados en la sucursal.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-primary" />
              Salarios fijos del mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalFixed)}</p>
            <p className="text-xs text-muted-foreground">
              Monto total comprometido en sueldos fijos.
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
              Comisiones generadas por ventas del mes.
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
          const pendingCommission =
            seller.totalCommissionMonth - seller.totalPaidMonth + seller.baseSalary;
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
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Salario fijo</p>
                    <p className="font-semibold">{formatCurrency(seller.baseSalary)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Comisiones mes</p>
                    <p className="font-semibold">
                      {formatCurrency(seller.totalCommissionMonth)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Pagado este mes</p>
                    <p className="font-semibold">{formatCurrency(seller.totalPaidMonth)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Por pagar aprox.</p>
                    <p className="font-semibold text-amber-600">
                      {formatCurrency(Math.max(pendingCommission, 0))}
                    </p>
                  </div>
                </div>
                <p className="pt-1 text-xs text-primary group-hover:underline">
                  Ver detalle de pagos y ventas
                </p>
              </CardContent>
            </Card>
          );
        })}

        {filteredSellers.length === 0 && (
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
                  Resumen de salarios fijos, comisiones y pagos registrados para este vendedor.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">
                        Salario fijo mensual
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-bold">
                        {formatCurrency(selectedSeller.baseSalary)}
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
                        {formatCurrency(selectedSeller.totalCommissionMonth)}
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
                        {formatCurrency(selectedSeller.totalPaidMonth)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Historial de pagos y comisiones</h3>
                    <span className="text-xs text-muted-foreground">
                      {selectedSeller.payments.length} movimientos
                    </span>
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSeller.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {payment.date}
                            </TableCell>
                            <TableCell className="text-xs">
                              {payment.concept}
                              {payment.saleCode && (
                                <span className="ml-1 text-[11px] text-muted-foreground">
                                  · {payment.saleCode}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {payment.type}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs font-semibold">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              <Badge
                                variant={
                                  payment.status === "Pagado" ? "default" : "outline"
                                }
                              >
                                {payment.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Vendedor</DialogTitle>
            <DialogDescription>
              Completa los datos básicos del vendedor. Luego podrás registrar sus comisiones y pagos.
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
              <Input
                id="role"
                placeholder="Ej: Vendedor, Vendedora Senior..."
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Sucursal</Label>
              <Input
                id="branch"
                placeholder="Ej: Sucursal Costanera"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseSalary">Salario fijo mensual (CLP)</Label>
              <Input
                id="baseSalary"
                type="number"
                min={0}
                step={1000}
                placeholder="Ej: 600000"
                value={newBaseSalary}
                onChange={(e) => setNewBaseSalary(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Guardar vendedor
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
