import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLeads } from "@/hooks/useLeads";
import { leadService } from "@/lib/services/leads";
import type { Database } from "@/lib/types/database";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const CONSIGNACION_TAG_PREFIX = "consignacion:";
const VEHICULO_TAG_PREFIX = "vehiculo:";
const REGION_TAG_PREFIX = "region:";

const getTagValue = (tags: unknown, prefix: string) => {
  const match = normalizeTags(tags).find((tag) => tag.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

function formatChilePhoneForDisplay(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+56")) {
    const digits = trimmed.replace(/\D/g, "");
    const number = digits.startsWith("56") ? digits.slice(2) : digits;
    if (!number) return "+56";
    if (number.startsWith("9")) {
      const rest = number.slice(1);
      return rest ? `+56 9 ${rest}` : "+56 9";
    }
    return `+56 ${number}`;
  }
  return trimmed;
}

const labelStyles: Record<string, { dot: string; text: string }> = {
  sin_etiqueta: { dot: "bg-slate-300", text: "text-slate-600" },
  Urgente: { dot: "bg-red-500", text: "text-red-600" },
  Prioritario: { dot: "bg-orange-500", text: "text-orange-600" },
  "Documentos pendientes": { dot: "bg-amber-500", text: "text-amber-600" },
  "Listo para publicar": { dot: "bg-emerald-500", text: "text-emerald-600" },
  Publicado: { dot: "bg-purple-500", text: "text-purple-600" },
  "Seguimiento semanal": { dot: "bg-blue-500", text: "text-blue-600" },
};

const statusLabels: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Interesado",
  negociando: "Negociando",
};

const stageStyles: Record<
  "nuevo" | "contactado" | "interesado" | "negociando",
  { border: string; badge: string; dot?: string }
> = {
  nuevo: { border: "", badge: "" },
  contactado: { border: "border-blue-500", badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  interesado: { border: "border-purple-500", badge: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  negociando: { border: "border-orange-500", badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
};

const normalizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return [] as string[];
  return tags.filter((tag) => typeof tag === "string") as string[];
};

const getConsignacionLabel = (tags: unknown): string | null => {
  const match = normalizeTags(tags).find((tag) =>
    tag.startsWith(CONSIGNACION_TAG_PREFIX),
  );
  if (!match) return null;
  const label = match.replace(CONSIGNACION_TAG_PREFIX, "").trim();
  if (!label || label === "sin_etiqueta") return null;
  return label;
};

function buildTagsWithVehicle(tags: unknown, vehicle: string): string[] {
  const current = normalizeTags(tags).filter((tag) => !tag.startsWith(VEHICULO_TAG_PREFIX));
  const v = vehicle.trim();
  if (!v) return current;
  return [...current, `${VEHICULO_TAG_PREFIX}${v}`];
}

function normalizePhoneChile(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("+56")) {
    const n = raw.replace(/^(\+56\s*)/g, "+56 ").trim();
    return n === "+56" ? "" : n;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("56") && digits.length >= 10) {
    const rest = digits.slice(2);
    return rest ? `+56 ${rest}` : "";
  }
  return `+56 ${raw}`;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatStateUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const LeadCard = memo(({ lead, onClick }: { lead: Lead; onClick: () => void }) => {
  const label = getConsignacionLabel(lead.tags);
  const styles = label ? (labelStyles[label] || labelStyles.sin_etiqueta) : null;
  const hasAiState = lead.state != null && lead.state !== "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <div className="font-medium">
        {lead.full_name || "Sin nombre"}
      </div>
      <div className="text-muted-foreground">
        {lead.phone || "Sin telefono"}
      </div>
      {label && styles && (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
            <span className={`${styles.text} font-medium`}>{label}</span>
          </span>
        </div>
      )}
      {hasAiState && (
        <div className="mt-2 rounded border border-dashed border-muted-foreground/30 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
          <div className="font-medium text-foreground/90">
            Estado IA: {lead.state}
            {lead.state_confidence != null && !Number.isNaN(Number(lead.state_confidence)) && (
              <span> ({Math.round(Number(lead.state_confidence) * 100)}%)</span>
            )}
          </div>
          {lead.state_reason && (
            <div className="mt-0.5 truncate" title={lead.state_reason}>{lead.state_reason}</div>
          )}
          {lead.state_updated_at && (
            <div className="mt-0.5 text-[10px] opacity-80">{formatStateUpdatedAt(lead.state_updated_at)}</div>
          )}
        </div>
      )}
    </div>
  );
});

export default function CRM() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { leads, loading, refetch } = useLeads({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user?.branch_id,
  });

  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string>("nuevo");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    region: "",
    payment_type: "",
    budget: "",
    notes: "",
    vehicle: "",
    status: "nuevo",
  });

  useEffect(() => {
    if (!user?.branch_id) return;
    refetch();
  }, [user?.branch_id, refetch]);

  // Cerrar diálogo al desmontar (evita error removeChild en producción)
  useEffect(() => {
    return () => {
      setShowEditDialog(false);
      setEditingLead(null);
    };
  }, []);

  const openEditDialog = useCallback((lead: Lead) => {
    setEditingLead(lead);
    setLeadStatus(lead.status || "nuevo");
    setIsEditingForm(false);
    setShowEditDialog(true);
  }, []);

  const closeEditDialog = useCallback(() => {
    setShowEditDialog(false);
    setEditingLead(null);
    setIsEditingForm(false);
  }, []);

  const startEditing = useCallback(() => {
    if (!editingLead) return;
    setEditForm({
      full_name: editingLead.full_name || "",
      phone: (editingLead.phone || "").replace(/^(\+56\s*)/g, ""),
      email: editingLead.email || "",
      region: editingLead.region || getTagValue(editingLead.tags, REGION_TAG_PREFIX) || "",
      payment_type: editingLead.payment_type || "",
      budget: editingLead.budget || "",
      notes: editingLead.notes || "",
      vehicle: getTagValue(editingLead.tags, VEHICULO_TAG_PREFIX) || "",
      status: editingLead.status || "nuevo",
    });
    setLeadStatus(editingLead.status || "nuevo");
    setIsEditingForm(true);
  }, [editingLead]);

  const handleUpdateLead = useCallback(async () => {
    if (!editingLead) return;
    setIsUpdating(true);
    try {
      const updates: Record<string, unknown> = isEditingForm
        ? {
            full_name: toTitleCase(editForm.full_name.trim()) || "Sin nombre",
            phone: normalizePhoneChile(editForm.phone) || "sin_telefono",
            email: editForm.email.trim() || null,
            status: editForm.status,
            region: editForm.region.trim() || null,
            payment_type: editForm.payment_type.trim() || null,
            budget: editForm.budget.trim() || null,
            notes: editForm.notes.trim() || null,
            tags: buildTagsWithVehicle(editingLead.tags, editForm.vehicle),
          }
        : { status: leadStatus };

      const updated = await leadService.update(editingLead.id, updates as any);
      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead));
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (isEditingForm) {
        setEditingLead(updated as Lead);
        setIsEditingForm(false);
      } else {
        closeEditDialog();
      }
    } catch (error: unknown) {
      console.error("Error actualizando lead:", error);
      alert(error instanceof Error ? error.message : "No se pudo actualizar el lead.");
    } finally {
      setIsUpdating(false);
    }
  }, [editingLead, leadStatus, isEditingForm, editForm, queryClient, closeEditDialog]);

  const stages = useMemo(
    () => [
      { key: "nuevo", label: "Nuevo", statuses: ["nuevo"] },
      { key: "contactado", label: "Contactado", statuses: ["contactado"] },
      { key: "interesado", label: "Interesado", statuses: ["interesado"] },
      { key: "negociando", label: "Negociando", statuses: ["negociando"] },
    ],
    [],
  );

  const leadsByStage = useMemo(() => {
    return stages.map((stage) => ({
      ...stage,
      leads: leads.filter((lead) => stage.statuses.includes(lead.status)),
    }));
  }, [leads, stages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground mt-2">
            Gestión de clientes y relaciones
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {leadsByStage.map((stage) => {
          const style = stageStyles[stage.key as keyof typeof stageStyles];

          return (
          <Card key={stage.key} className={`border-t-4 ${style?.border || ""}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  {style?.dot && <span className={`h-2 w-2 rounded-full ${style.dot}`} />}
                  {stage.label}
                </span>
                <Badge className={style?.badge || ""} variant="secondary">
                  {stage.leads.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 min-h-[180px]">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Cargando leads...
                  </p>
                ) : stage.leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No hay leads en esta etapa
                  </p>
                ) : (
                  stage.leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onClick={() => openEditDialog(lead)} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )        })}
      </div>

      <Dialog open={showEditDialog} onOpenChange={(open) => (open ? null : closeEditDialog())}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div className="space-y-1.5">
              <DialogTitle>Lead — Información y estado</DialogTitle>
              <DialogDescription>
                {isEditingForm ? "Edita los datos del lead." : "Datos del lead y cambio de estado en el pipeline."}
              </DialogDescription>
            </div>
            {editingLead && !isEditingForm && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={startEditing}
                className="shrink-0"
                aria-label="Editar datos del lead"
                title="Editar datos del lead"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </DialogHeader>
          {editingLead && (
            <div className="space-y-4 py-2">
              {isEditingForm ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-name">Nombre</Label>
                      <Input
                        id="crm-edit-name"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-phone">Teléfono</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+56</span>
                        <Input
                          id="crm-edit-phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                          placeholder="9 ..."
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-email">Correo</Label>
                      <Input
                        id="crm-edit-email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="correo@ejemplo.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-region">Región</Label>
                      <Input
                        id="crm-edit-region"
                        value={editForm.region}
                        onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))}
                        placeholder="Ej: Metropolitana"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-payment">Financiamiento / Contado</Label>
                      <Input
                        id="crm-edit-payment"
                        value={editForm.payment_type}
                        onChange={(e) => setEditForm((f) => ({ ...f, payment_type: e.target.value }))}
                        placeholder="Ej: Contado"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-budget">Presupuesto</Label>
                      <Input
                        id="crm-edit-budget"
                        value={editForm.budget}
                        onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))}
                        placeholder="Ej: 10-12 millones"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="crm-edit-vehicle">Vehículo de interés</Label>
                    <Input
                      id="crm-edit-vehicle"
                      value={editForm.vehicle}
                      onChange={(e) => setEditForm((f) => ({ ...f, vehicle: e.target.value }))}
                      placeholder="Ej: Toyota Corolla 2020"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="crm-edit-notes">Nota</Label>
                    <Textarea
                      id="crm-edit-notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Notas sobre el lead..."
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-2 pt-2 border-t">
                    <Label>Estado en el pipeline</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(v) => {
                        setEditForm((f) => ({ ...f, status: v }));
                        setLeadStatus(v);
                      }}
                    >
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
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Nombre</p>
                      <p className="text-base font-medium">{editingLead.full_name || "Sin nombre"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Teléfono</p>
                      <p className="text-base">{formatChilePhoneForDisplay(editingLead.phone) || "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Correo</p>
                      <p className="text-base">{editingLead.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Región</p>
                      <p className="text-base">
                        {editingLead.region || getTagValue(editingLead.tags, REGION_TAG_PREFIX) || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Financiamiento / Contado</p>
                      <p className="text-base">{editingLead.payment_type || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Presupuesto</p>
                      <p className="text-base">{editingLead.budget || "—"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vehículo de interés</p>
                    <p className="text-base">
                      {getTagValue(editingLead.tags, VEHICULO_TAG_PREFIX) || "—"}
                    </p>
                  </div>
                  {getConsignacionLabel(editingLead.tags) && (
                    <div>
                      <p className="text-sm text-muted-foreground">Etiqueta consignación</p>
                      <p className="text-base">{getConsignacionLabel(editingLead.tags)}</p>
                    </div>
                  )}
                  {(editingLead.state != null && editingLead.state !== "") && (
                    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2">
                      <p className="text-sm text-muted-foreground">Estado IA</p>
                      <p className="text-base">
                        {editingLead.state}
                        {editingLead.state_confidence != null && !Number.isNaN(Number(editingLead.state_confidence)) && (
                          <span className="text-muted-foreground"> ({Math.round(Number(editingLead.state_confidence) * 100)}%)</span>
                        )}
                      </p>
                      {editingLead.state_reason && (
                        <p className="text-sm text-muted-foreground mt-1">{editingLead.state_reason}</p>
                      )}
                    </div>
                  )}
                  {editingLead.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Nota</p>
                      <p className="text-base whitespace-pre-wrap">{editingLead.notes}</p>
                    </div>
                  )}
                  <div className="grid gap-2 pt-2 border-t">
                    <Label>Estado en el pipeline</Label>
                    <Select value={leadStatus} onValueChange={setLeadStatus}>
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
                </>
              )}
            </div>
          )}
          <DialogFooter>
            {isEditingForm ? (
              <>
                <Button variant="outline" onClick={() => setIsEditingForm(false)} disabled={isUpdating}>
                  Cancelar edición
                </Button>
                <Button onClick={handleUpdateLead} disabled={isUpdating || !editForm.full_name.trim() || !editForm.phone.trim()}>
                  {isUpdating ? "Guardando..." : "Guardar cambios"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={closeEditDialog}>
                  Cerrar
                </Button>
                <Button onClick={handleUpdateLead} disabled={isUpdating}>
                  {isUpdating ? "Guardando..." : "Guardar cambios"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
