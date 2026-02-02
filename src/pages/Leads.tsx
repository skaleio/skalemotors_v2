import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useConsignaciones } from "@/hooks/useConsignaciones";
import { useLeads } from "@/hooks/useLeads";
import { leadService } from "@/lib/services/leads";
import { Filter, Mail, Pencil, Phone, Plus, Search, Target, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const CONSIGNACION_TAG_PREFIX = "consignacion:";
const VEHICULO_TAG_PREFIX = "vehiculo:";
const REGION_TAG_PREFIX = "region:";
const NEW_LEAD_PATH = "/leads?new=true";

const normalizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return [] as string[];
  return tags.filter((tag) => typeof tag === "string") as string[];
};

const getTagValue = (tags: unknown, prefix: string) => {
  const match = normalizeTags(tags).find((tag) => tag.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

const buildTags = (tags: string[]) => tags.filter((tag) => tag.trim().length > 0);

const removeVehicleTags = (tags: unknown) =>
  normalizeTags(tags).filter((tag) => !tag.startsWith(VEHICULO_TAG_PREFIX));

const buildTagsWithVehicle = (tags: unknown, vehicle: string) => {
  const current = removeVehicleTags(tags);
  const nextVehicle = vehicle.trim();
  if (!nextVehicle) return current;
  return [...current, `${VEHICULO_TAG_PREFIX}${nextVehicle}`];
};

const normalizePhoneWithChilePrefix = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("+56")) {
    const normalized = raw.replace(/^(\+56\s*)/g, "+56 ").trim();
    return normalized === "+56" ? "" : normalized;
  }
  return `+56 ${raw}`;
};


type ConsignacionItem = {
  id: string;
  lead_id?: string | null;
  label?: string | null;
  vehicle_id?: string | null;
  vehicle?: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
  } | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
};

const getConsignacionVehicleLabel = (item?: ConsignacionItem | null) => {
  if (!item) return "";
  if (item.vehicle) {
    return `${item.vehicle.year || ""} ${item.vehicle.make || ""} ${item.vehicle.model || ""}`.trim();
  }
  return `${item.vehicle_year || ""} ${item.vehicle_make || ""} ${item.vehicle_model || ""}`.trim();
};

const statusLabels: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Interesado",
  cotizando: "Cotizando",
  negociando: "Negociando",
  vendido: "Cerrado (Vendiendo)",
  perdido: "Cerrado (Perdido)",
};

const statusStyles: Record<string, { dot: string; text: string }> = {
  nuevo: { dot: "bg-slate-400", text: "text-slate-700" },
  contactado: { dot: "bg-blue-500", text: "text-blue-600" },
  interesado: { dot: "bg-indigo-500", text: "text-indigo-600" },
  cotizando: { dot: "bg-amber-500", text: "text-amber-600" },
  negociando: { dot: "bg-orange-500", text: "text-orange-600" },
  vendido: { dot: "bg-emerald-600", text: "text-emerald-700" },
  perdido: { dot: "bg-red-500", text: "text-red-600" },
};

const getStatusMeta = (value: string) => {
  const normalized = value || "nuevo";
  return {
    label: statusLabels[normalized] || normalized,
    styles: statusStyles[normalized] || statusStyles.nuevo,
  };
};

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { leads, loading, refetch } = useLeads({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });
  const { consignaciones } = useConsignaciones({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formState, setFormState] = useState({
    full_name: "",
    phone: "",
    status: "nuevo",
    vehicle: "",
    region: "",
    payment_type: "",
    budget: "",
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingLead, setEditingLead] = useState<(typeof leads)[number] | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingLead, setDeletingLead] = useState<(typeof leads)[number] | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    status: "nuevo",
    vehicle: "",
    region: "",
    payment_type: "",
    budget: "",
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isShortcut = (event.ctrlKey || event.metaKey) && key === "l";

      if (key === "escape") {
        if (showCreateDialog) {
          event.preventDefault();
          setShowCreateDialog(false);
        }
        return;
      }

      if (!isShortcut) return;

      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target
        && (target.tagName === "INPUT"
          || target.tagName === "TEXTAREA"
          || target.tagName === "SELECT"
          || target.isContentEditable);

      if (isTyping) return;

      event.preventDefault();
      if (location.pathname.endsWith("/leads") || location.pathname.endsWith("/app/leads")) {
        setShowCreateDialog(true);
      }
      navigate(NEW_LEAD_PATH);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [location.pathname, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "true") {
      setShowCreateDialog(true);
    }
  }, [location.search]);

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = !query
        || lead.full_name.toLowerCase().includes(query)
        || (lead.email || "").toLowerCase().includes(query)
        || (lead.phone || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, statusFilter]);

  const consignacionByLeadId = useMemo(() => {
    const map = new Map<string, ConsignacionItem>();
    (consignaciones as ConsignacionItem[]).forEach((item) => {
      if (item.lead_id) map.set(item.lead_id, item);
    });
    return map;
  }, [consignaciones]);

  const handleStatusChange = async (leadId: string, nextStatus: string) => {
    const currentLead = leads.find((item) => item.id === leadId);
    if (!currentLead || currentLead.status === nextStatus) return;

    try {
      await leadService.update(leadId, { status: nextStatus as any });
      await refetch();
    } catch (error: any) {
      console.error("Error actualizando estado del lead:", error);
      await refetch();
      alert(error?.message || "No se pudo actualizar el estado del lead.");
    }
  };

  const vehicleLabel = formState.vehicle.trim();

  const canSubmit = Boolean(
    formState.full_name.trim()
      && formState.phone.trim()
      && formState.status
  );

  const resetForm = () => {
    setFormState({
      full_name: "",
      phone: "",
      status: "nuevo",
      vehicle: "",
      region: "",
      payment_type: "",
      budget: "",
    });
  };

  const handleCreateLead = async () => {
    if (!user || !canSubmit) return;
    setIsCreating(true);

    try {
      const tags: string[] = [];
      if (vehicleLabel) {
        tags.push(`${VEHICULO_TAG_PREFIX}${vehicleLabel}`);
      }

      await leadService.create({
        full_name: formState.full_name.trim(),
        phone: normalizePhoneWithChilePrefix(formState.phone),
        status: formState.status as any,
        source: formState.phone.trim() ? "telefono" : "otro",
        priority: "media",
        branch_id: user.branch_id,
        region: formState.region.trim() ? formState.region.trim() : null,
        payment_type: formState.payment_type ? formState.payment_type : null,
        budget: formState.budget.trim() ? formState.budget.trim() : null,
        tags: buildTags(tags) as any,
      });

      await refetch();
      resetForm();
      setShowCreateDialog(false);
    } catch (error: any) {
      console.error("Error creando lead:", error);
      alert(error?.message || "No se pudo crear el lead.");
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = (lead: (typeof leads)[number]) => {
    const tags = normalizeTags(lead.tags);
    const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
    const consignacion = consignacionByLeadId.get(lead.id);
    const consignacionVehicle = getConsignacionVehicleLabel(consignacion);
    setEditingLead(lead);
    setEditForm({
      full_name: lead.full_name || "",
      phone: (lead.phone || "").replace(/^(\+56\s*)/g, ""),
      email: lead.email || "",
      status: lead.status || "nuevo",
      vehicle: isConsignacion
        ? consignacionVehicle || getTagValue(tags, VEHICULO_TAG_PREFIX)
        : getTagValue(tags, VEHICULO_TAG_PREFIX),
      region: lead.region || getTagValue(tags, REGION_TAG_PREFIX),
      payment_type: lead.payment_type || "",
      budget: lead.budget || "",
    });
    setShowEditDialog(true);
  };

  const closeEditDialog = () => {
    setShowEditDialog(false);
    setEditingLead(null);
  };

  const handleUpdateLead = async () => {
    if (!editingLead) return;
    setIsUpdating(true);

    try {
      const updates: Record<string, any> = {
        full_name: editForm.full_name.trim() || "Sin nombre",
        phone: normalizePhoneWithChilePrefix(editForm.phone) || "sin_telefono",
        email: editForm.email.trim() ? editForm.email.trim() : null,
        status: editForm.status as any,
        region: editForm.region.trim() ? editForm.region.trim() : null,
        payment_type: editForm.payment_type ? editForm.payment_type : null,
        budget: editForm.budget.trim() ? editForm.budget.trim() : null,
      };

      updates.tags = buildTagsWithVehicle(editingLead.tags, editForm.vehicle) as any;

      await leadService.update(editingLead.id, updates);
      await refetch();
      closeEditDialog();
    } catch (error: any) {
      console.error("Error actualizando lead:", error);
      alert(error?.message || "No se pudo actualizar el lead.");
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteDialog = (lead: (typeof leads)[number]) => {
    setDeletingLead(lead);
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeletingLead(null);
  };

  const handleDeleteLead = async () => {
    if (!deletingLead) return;
    try {
      await leadService.delete(deletingLead.id);
      await refetch();
      closeDeleteDialog();
    } catch (error: any) {
      console.error("Error eliminando lead:", error);
      alert(error?.message || "No se pudo eliminar el lead.");
    }
  };

  const editTags = normalizeTags(editingLead?.tags);
  const editIsConsignacion = editTags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
  const editConsignacionVehicle = editingLead
    ? getConsignacionVehicleLabel(consignacionByLeadId.get(editingLead.id))
    : "";
  const editVehicleValue = editForm.vehicle;
  const canUpdate = Boolean(
    editForm.full_name.trim()
      && editForm.phone.trim()
      && editForm.status
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus leads y oportunidades de venta
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Lead
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Lista de Leads
          </CardTitle>
          <CardDescription>
            Gestiona y sigue el progreso de tus leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Vehiculo</TableHead>
                <TableHead>Región</TableHead>
                <TableHead>Financiamiento/Contado</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Cargando leads...
                  </TableCell>
                </TableRow>
              ) : filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No hay leads registrados
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.full_name || "Sin nombre"}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{lead.phone || "Sin telefono"}</span>
                        </div>
                        {lead.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{lead.email}</span>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const tags = normalizeTags(lead.tags);
                        const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
                        const label = isConsignacion ? "Consignacion" : "Lead";
                        return <Badge variant="secondary">{label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const tags = normalizeTags(lead.tags);
                        const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
                        if (isConsignacion) {
                          const consignacion = consignacionByLeadId.get(lead.id);
                          const consignacionVehicle = getConsignacionVehicleLabel(consignacion);
                          return consignacionVehicle || getTagValue(tags, VEHICULO_TAG_PREFIX) || "—";
                        }
                        return getTagValue(tags, VEHICULO_TAG_PREFIX) || "—";
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const region = lead.region || getTagValue(lead.tags, REGION_TAG_PREFIX);
                        return region ? <Badge variant="secondary">{region}</Badge> : "—";
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const label = lead.payment_type?.trim();
                        return label ? <Badge variant="secondary">{label}</Badge> : "—";
                      })()}
                    </TableCell>
                    <TableCell>{lead.budget || "—"}</TableCell>
                    <TableCell>
                      {(() => {
                        const meta = getStatusMeta(lead.status);
                        return (
                          <Select
                            value={lead.status}
                            onValueChange={(value) => handleStatusChange(lead.id, value)}
                          >
                            <SelectTrigger
                              className="h-8 w-auto gap-2 rounded-full border px-3"
                              aria-label={`Estado ${meta.label}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${meta.styles.dot}`} />
                              <span className={`text-xs font-medium ${meta.styles.text}`}>{meta.label}</span>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(([key, label]) => {
                                const styles = statusStyles[key] || statusStyles.nuevo;
                                return (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                                      <span className={styles.text}>{label}</span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {new Date(lead.created_at).toLocaleDateString("es-CL")}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(lead)}
                          aria-label="Editar lead"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(lead)}
                          aria-label="Eliminar lead"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Nuevo lead</DialogTitle>
            <DialogDescription>
              Completa los datos básicos para registrar un lead.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="lead_full_name">Nombre</Label>
              <Input
                id="lead_full_name"
                value={formState.full_name}
                onChange={(e) => setFormState({ ...formState, full_name: e.target.value })}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead_phone">Telefono</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  +56
                </span>
                <Input
                  id="lead_phone"
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                  placeholder="9 ..."
                  className="pl-12"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead_vehicle">Vehiculo</Label>
              <Input
                id="lead_vehicle"
                value={formState.vehicle}
                onChange={(e) => setFormState({ ...formState, vehicle: e.target.value })}
                placeholder="Ej: Toyota Corolla 2020"
              />
            </div>
            <div className="grid gap-2">
              <Label>Región</Label>
              <Input
                value={formState.region}
                onChange={(e) => setFormState({ ...formState, region: e.target.value })}
                placeholder="Ej: Metropolitana de Santiago"
              />
            </div>
            <div className="grid gap-2">
              <Label>Financiamiento/Contado</Label>
              <Input
                value={formState.payment_type}
                onChange={(e) => setFormState({ ...formState, payment_type: e.target.value })}
                placeholder="Ej: Financiamiento o Contado"
              />
            </div>
            <div className="grid gap-2">
              <Label>Presupuesto</Label>
              <Input
                value={formState.budget}
                onChange={(e) => setFormState({ ...formState, budget: e.target.value })}
                placeholder="Ej: 10-12 millones"
              />
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select value={formState.status} onValueChange={(value) => setFormState({ ...formState, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateLead} disabled={!canSubmit || isCreating}>
              {isCreating ? "Guardando..." : "Crear lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={(open) => (open ? null : closeEditDialog())}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Editar lead</DialogTitle>
            <DialogDescription>
              Actualiza los datos principales del lead.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit_lead_full_name">Nombre</Label>
              <Input
                id="edit_lead_full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_lead_phone">Telefono</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  +56
                </span>
                <Input
                  id="edit_lead_phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="9 ..."
                  className="pl-12"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_lead_email">Correo</Label>
              <Input
                id="edit_lead_email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="correo@empresa.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_lead_vehicle">Vehiculo</Label>
              <Input
                id="edit_lead_vehicle"
                value={editVehicleValue}
                onChange={(e) => setEditForm({ ...editForm, vehicle: e.target.value })}
                placeholder="Ej: Toyota Corolla 2020"
              />
            </div>
            <div className="grid gap-2">
              <Label>Región</Label>
              <Input
                value={editForm.region}
                onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                placeholder="Ej: Metropolitana de Santiago"
              />
            </div>
            <div className="grid gap-2">
              <Label>Financiamiento/Contado</Label>
              <Input
                value={editForm.payment_type}
                onChange={(e) => setEditForm({ ...editForm, payment_type: e.target.value })}
                placeholder="Ej: Financiamiento o Contado"
              />
            </div>
            <div className="grid gap-2">
              <Label>Presupuesto</Label>
              <Input
                value={editForm.budget}
                onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                placeholder="Ej: 10-12 millones"
              />
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateLead} disabled={!canUpdate || isUpdating}>
              {isUpdating ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => (open ? null : closeDeleteDialog())}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Eliminar lead</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar este lead? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteLead}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
