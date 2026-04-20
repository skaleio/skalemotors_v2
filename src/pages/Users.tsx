import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users as UsersIcon, Plus, Search, Shield, Mail, Loader2, KeyRound, Trash2 } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/lib/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"] & {
  branch?: { name: string } | null;
};

type BranchPick = { id: string; name: string };

type SalesStaffRow = Database["public"]["Tables"]["branch_sales_staff"]["Row"] & {
  branch?: { name: string } | null;
};

const MANUAL_STAFF_VALUE = "__manual__";

async function createVendorViaEdgeFunction(payload: {
  email: string;
  password: string;
  full_name: string;
  branch_id: string;
}): Promise<{ ok: boolean; user_id?: string; email?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Tu sesión expiró. Cierra sesión y vuelve a entrar.");
  }
  const base = (supabaseUrl ?? "").replace(/\/$/, "");
  if (!base) {
    throw new Error("Falta VITE_SUPABASE_URL en la configuración del build.");
  }
  const url = `${base}/functions/v1/vendor-user-create`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey ?? "",
        "x-client-info": "skale-motors-web",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `No se pudo conectar con el servidor (${msg}). Revisa tu red, que en Supabase esté desplegada la función «vendor-user-create» y que VITE_SUPABASE_URL apunte a este proyecto (sin barra final al final del dominio).`,
    );
  }
  const text = await res.text();
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    throw new Error(
      `Respuesta inesperada (${res.status}). ¿Existe la función «vendor-user-create»? ${text.slice(0, 160)}`,
    );
  }
  if (!res.ok) {
    throw new Error(body.error || `Error ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!body.ok) {
    throw new Error(body.error || "No se pudo crear el vendedor");
  }
  return body as { ok: boolean; user_id?: string; email?: string };
}

async function deleteVendorViaEdgeFunction(userId: string): Promise<{ ok: boolean; user_id?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Tu sesión expiró. Cierra sesión y vuelve a entrar.");
  }
  const base = (supabaseUrl ?? "").replace(/\/$/, "");
  if (!base) {
    throw new Error("Falta VITE_SUPABASE_URL en la configuración del build.");
  }
  const url = `${base}/functions/v1/vendor-user-delete`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey ?? "",
        "x-client-info": "skale-motors-web",
      },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `No se pudo conectar con el servidor (${msg}). Revisa que la función «vendor-user-delete» esté desplegada.`,
    );
  }
  const text = await res.text();
  let body: { ok?: boolean; error?: string } = {};
  try {
    body = text ? (JSON.parse(text) as typeof body) : {};
  } catch {
    throw new Error(
      `Respuesta inesperada (${res.status}). ¿Existe la función «vendor-user-delete»? ${text.slice(0, 160)}`,
    );
  }
  if (!res.ok) {
    throw new Error(body.error || `Error ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!body.ok) {
    throw new Error(body.error || "No se pudo eliminar el usuario");
  }
  return body as { ok: boolean; user_id?: string };
}

const CAN_MANAGE_TEAM = new Set(["admin", "jefe_jefe", "gerente", "jefe_sucursal"]);

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
  financiero: "Finanzas",
  servicio: "Servicio",
  inventario: "Inventario",
  jefe_jefe: "Jefe general",
  jefe_sucursal: "Jefe sucursal",
};

export default function Users() {
  const { user, resetPassword } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [recoverySendingFor, setRecoverySendingFor] = useState<string | null>(null);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newBranchId, setNewBranchId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>(MANUAL_STAFF_VALUE);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", "users_page", user?.tenant_id],
    enabled: !!user?.tenant_id,
    queryFn: async (): Promise<BranchPick[]> => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("tenant_id", user!.tenant_id!)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BranchPick[];
    },
  });

  const { data: salesStaff = [], isLoading: loadingSalesStaff } = useQuery({
    queryKey: ["branch_sales_staff", "users_create_vendor", user?.tenant_id, user?.branch_id],
    enabled: !!user?.tenant_id && createOpen,
    queryFn: async (): Promise<SalesStaffRow[]> => {
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
      return (data ?? []) as SalesStaffRow[];
    },
  });

  useEffect(() => {
    if (newBranchId) return;
    if (user?.branch_id && branches.some((b) => b.id === user.branch_id)) {
      setNewBranchId(user.branch_id);
      return;
    }
    if (branches.length === 1) {
      setNewBranchId(branches[0].id);
    }
  }, [user?.branch_id, branches, newBranchId]);

  const { data: team = [], isLoading: loadingTeam } = useQuery({
    queryKey: ["tenant_users", user?.tenant_id],
    enabled: !!user?.tenant_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, full_name, role, branch_id, is_active, branch:branches(name)")
        .eq("tenant_id", user!.tenant_id!)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: deleteVendorViaEdgeFunction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant_users"] });
      setDeleteConfirmRow(null);
      toast({
        title: "Usuario eliminado",
        description: "Se quitó el acceso y el perfil del vendedor.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "No se pudo eliminar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: createVendorViaEdgeFunction,
    onSuccess: () => {
      // Invalidar primero para que la tabla se refresque al cerrarse el modal
      void queryClient.invalidateQueries({ queryKey: ["tenant_users"] });
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewBranchId("");
      setSelectedStaffId(MANUAL_STAFF_VALUE);
      toast({
        title: "Vendedor creado",
        description: "Ya puede iniciar sesión con el correo y contraseña indicados. Verá solo sus leads en el CRM.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "No se pudo crear",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return team;
    return team.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.role && r.role.toLowerCase().includes(q)) ||
        (r.branch?.name && r.branch.name.toLowerCase().includes(q)),
    );
  }, [team, searchQuery]);

  const openCreate = () => {
    setNewEmail("");
    setNewPassword("");
    setNewFullName("");
    setSelectedStaffId(MANUAL_STAFF_VALUE);
    setNewBranchId(
      user?.branch_id && branches.some((b) => b.id === user.branch_id)
        ? user.branch_id
        : branches.length === 1
          ? branches[0].id
          : "",
    );
    setCreateOpen(true);
  };

  const applyStaffSelection = (staffId: string) => {
    setSelectedStaffId(staffId);
    if (staffId === MANUAL_STAFF_VALUE) {
      return;
    }
    const row = salesStaff.find((s) => s.id === staffId);
    if (!row) return;
    setNewFullName(row.full_name);
    if (row.branch_id) {
      setNewBranchId(row.branch_id);
    } else if (user?.branch_id && branches.some((b) => b.id === user.branch_id)) {
      setNewBranchId(user.branch_id);
    } else if (branches.length === 1) {
      setNewBranchId(branches[0].id);
    }
  };

  const sendPasswordRecovery = async (email: string) => {
    setRecoverySendingFor(email);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast({
          title: "No se pudo enviar el correo",
          description: "Revisa la configuración de Auth o inténtalo más tarde.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Correo enviado",
        description: "Si la cuenta existe, el usuario recibirá un enlace para restablecer la contraseña.",
      });
    } finally {
      setRecoverySendingFor(null);
    }
  };

  const canManageTeam = user?.role ? CAN_MANAGE_TEAM.has(user.role) : false;

  const canOfferDeleteForRow = (row: UserRow) => {
    if (!user?.id || !canManageTeam) return false;
    if (row.id === user.id) return false;
    if (row.role !== "vendedor" || !row.is_active) return false;
    if (user.role === "gerente" || user.role === "jefe_sucursal") {
      if (!user.branch_id || row.branch_id !== user.branch_id) return false;
    }
    return true;
  };

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || !newPassword || !newFullName.trim() || !newBranchId) {
      toast({ title: "Completa el formulario", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Contraseña corta", description: "Mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    createVendorMutation.mutate({
      email,
      password: newPassword,
      full_name: newFullName.trim(),
      branch_id: newBranchId,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground mt-2">
            Crea cuentas de vendedor con correo y contraseña. Cada uno accede solo a sus leads (CRM y lista
            filtrada). Si olvidan la contraseña, pueden usar «Olvidé mi contraseña» en el login o tú puedes
            reenviar el enlace desde la tabla.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!user?.tenant_id || branches.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo vendedor
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, correo, rol o sucursal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Equipo
          </CardTitle>
          <CardDescription>Usuarios de tu organización ({user?.tenant_id ? "activos" : "…"})</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTeam ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay usuarios que coincidan
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {row.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <span className="inline-flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {ROLE_LABEL[row.role] ?? row.role}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>{row.branch?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? "default" : "destructive"}>
                        {row.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.role === "vendedor" && row.is_active ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={recoverySendingFor === row.email}
                            onClick={() => void sendPasswordRecovery(row.email)}
                          >
                            {recoverySendingFor === row.email ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <KeyRound className="h-3.5 w-3.5" />
                            )}
                            Enlace recuperación
                          </Button>
                          {canOfferDeleteForRow(row) ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => setDeleteConfirmRow(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Eliminar
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteConfirmRow}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmRow(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar acceso de {deleteConfirmRow?.full_name ?? "este usuario"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará la sesión en todos los dispositivos y se borrará el perfil del vendedor. Esta acción no se
              puede deshacer. Los leads u otros registros que lo referenciaban se conservan (p. ej. creador en documentos
              se deja sin asignar).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVendorMutation.isPending}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteVendorMutation.isPending || !deleteConfirmRow}
              onClick={() => {
                if (deleteConfirmRow) deleteVendorMutation.mutate(deleteConfirmRow.id);
              }}
            >
              {deleteVendorMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                  Eliminando…
                </>
              ) : (
                "Eliminar definitivamente"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo vendedor</DialogTitle>
            <DialogDescription>
              Se creará un usuario con rol vendedor. Podrá entrar en{" "}
              <span className="font-medium text-foreground">/login</span> y trabajar solo sus leads.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Vendedor (desde sección Vendedores)</Label>
              <Select
                value={selectedStaffId}
                onValueChange={applyStaffSelection}
                disabled={loadingSalesStaff}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingSalesStaff ? "Cargando lista…" : "Elige un nombre o escribe uno manual"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MANUAL_STAFF_VALUE}>Otro — escribir nombre abajo</SelectItem>
                  {salesStaff.map((s) => {
                    const branchHint = s.branch?.name
                      ? ` · ${s.branch.name}`
                      : !s.branch_id
                        ? " · Todas las sucursales"
                        : "";
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                        {branchHint}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Lista de la plantilla comercial en Finanzas → Vendedores. Si no aparece alguien, créalo allí
                primero o usa «Otro».
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nv-name">Nombre completo</Label>
              <Input
                id="nv-name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="María Pérez"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nv-email">Correo (será el usuario de acceso)</Label>
              <Input
                id="nv-email"
                type="email"
                autoComplete="off"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="maria@tuempresa.cl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nv-pass">Contraseña inicial</Label>
              <Input
                id="nv-pass"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={newBranchId} onValueChange={setNewBranchId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Los leads del vendedor deben coincidir con esta sucursal (reglas de seguridad en base de datos).
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createVendorMutation.isPending}>
                {createVendorMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando…
                  </>
                ) : (
                  "Crear acceso"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
