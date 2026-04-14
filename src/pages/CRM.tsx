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
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Search, Trash2 } from "lucide-react";
import type { DragEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

type CloseDealSellerOption = { key: string; label: string };

function closeDealSellerKeyUser(userId: string) {
  return `u:${userId}`;
}

function closeDealSellerKeyStaff(staffId: string) {
  return `s:${staffId}`;
}

function parseCloseDealSellerKey(key: string): { kind: "user" | "staff"; id: string } | null {
  if (key.startsWith("u:")) return { kind: "user", id: key.slice(2) };
  if (key.startsWith("s:")) return { kind: "staff", id: key.slice(2) };
  return null;
}

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
  contactado: "CONTACTADO",
  negociando: "NEGOCIANDO",
  para_cierre: "PARA CIERRE",
  negocio_cerrado: "NEGOCIO CONCRETADO",
};

/**
 * Valor seguro para <Select> del pipeline CRM (4 estados).
 * Mapea estados legacy al bucket correspondiente.
 */
function safePipelineSelectValue(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  if (s === "negociando" || s === "cotizando") return "negociando";
  if (s === "para_cierre") return "para_cierre";
  if (s === "vendido") return "negocio_cerrado";
  if (s === "contactado" || s === "nuevo" || s === "interesado") return "contactado";
  return "contactado";
}

type CrmStageKey = "contactado" | "negociando" | "para_cierre" | "negocio_cerrado";

/** MIME para DataTransfer (evita colisiones con texto plano). */
const DRAG_LEAD_MIME = "application/x-skale-lead-id";

/** Valor `leads.status` al soltar en una columna del pipeline. */
function pipelineDbStatusForStage(stageKey: CrmStageKey): string {
  if (stageKey === "contactado") return "contactado";
  if (stageKey === "negociando") return "negociando";
  if (stageKey === "para_cierre") return "para_cierre";
  return "vendido";
}

const stageStyles: Record<CrmStageKey, { border: string; badge: string; dot?: string }> = {
  contactado: { border: "border-blue-500", badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  negociando: { border: "border-orange-500", badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  para_cierre: { border: "border-emerald-500", badge: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  negocio_cerrado: { border: "border-red-600", badge: "bg-red-50 text-red-700", dot: "bg-red-600" },
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

const LeadCard = memo(function LeadCard({
  lead,
  onClick,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onExternalDragOver,
  onExternalDrop,
  justLanded,
}: {
  lead: Lead;
  onClick: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  /** Permite soltar sobre otra tarjeta (el drop no llega al contenedor de columna). */
  onExternalDragOver?: (e: DragEvent) => void;
  onExternalDrop?: (e: DragEvent) => void;
  /** Breve feedback visual tras soltar en otra columna (sin toast). */
  justLanded?: boolean;
}) {
  const label = getConsignacionLabel(lead.tags);
  const styles = label ? (labelStyles[label] || labelStyles.sin_etiqueta) : null;
  const hasAiState = lead.state != null && lead.state !== "";
  const lastDragEndRef = useRef(0);

  const handleClick = () => {
    if (Date.now() - lastDragEndRef.current < 400) return;
    onClick();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!!draggable}
      onDragStart={(e) => {
        onDragStart?.(e);
      }}
      onDragEnd={(e) => {
        lastDragEndRef.current = Date.now();
        onDragEnd?.(e);
      }}
      onDragOver={(e) => {
        onExternalDragOver?.(e);
      }}
      onDrop={(e) => {
        onExternalDrop?.(e);
      }}
      onClick={handleClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleClick()}
      aria-grabbed={isDragging ? true : undefined}
      title={draggable ? "Arrastra a otra columna o haz clic para abrir" : undefined}
      className={cn(
        "rounded-lg border bg-card px-3 py-2 text-sm shadow-sm",
        "transition-[transform,opacity,box-shadow,ring] duration-200 ease-out",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        draggable ? "cursor-grab touch-none active:cursor-grabbing hover:bg-muted/40 hover:shadow-md" : "cursor-pointer hover:bg-muted/50",
        isDragging &&
          "scale-[0.97] border-dashed border-primary/50 bg-muted/50 opacity-[0.42] shadow-none ring-0",
        justLanded && "animate-in zoom-in-95 fade-in duration-300 ring-2 ring-emerald-500/35 shadow-md",
      )}
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
  const { leads, loading, error: leadsError, refetch } = useLeads({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string>("contactado");
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
    status: "contactado",
  });

  useEffect(() => {
    if (!user) return;
    refetch();
  }, [user?.branch_id, user, refetch]);

  // Cerrar diálogo al desmontar (evita error removeChild en producción)
  useEffect(() => {
    return () => {
      setShowEditDialog(false);
      setEditingLead(null);
    };
  }, []);

  const openEditDialog = useCallback((lead: Lead) => {
    setEditingLead(lead);
    setLeadStatus(safePipelineSelectValue(lead.status));
    setIsEditingForm(false);
    setShowEditDialog(true);
  }, []);

  const closeEditDialog = useCallback(() => {
    setShowEditDialog(false);
    setEditingLead(null);
    setIsEditingForm(false);
  }, []);

  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteLead = useCallback(async () => {
    if (!editingLead) return;
    if (!confirm("¿Eliminar este lead? Esta acción no se puede deshacer.")) return;
    setIsDeleting(true);
    try {
      await leadService.delete(editingLead.id);
      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.filter((lead: { id: string }) => lead.id !== editingLead.id);
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      closeEditDialog();
      toast({
        title: "Lead eliminado",
        description: "El lead se eliminó correctamente.",
      });
    } catch (error) {
      console.error("Error eliminando lead:", error);
      toast({
        title: "Error al eliminar",
        description: error instanceof Error ? error.message : "No se pudo eliminar el lead.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [editingLead, queryClient, closeEditDialog]);

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
      status: safePipelineSelectValue(editingLead.status),
    });
    setLeadStatus(safePipelineSelectValue(editingLead.status));
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
      {
        key: "contactado" as const,
        label: "CONTACTADO",
        statuses: ["contactado", "nuevo", "interesado"],
      },
      {
        key: "negociando" as const,
        label: "NEGOCIANDO",
        statuses: ["negociando", "cotizando"],
      },
      { key: "para_cierre" as const, label: "PARA CIERRE", statuses: ["para_cierre"] },
      { key: "negocio_cerrado" as const, label: "NEGOCIO CONCRETADO", statuses: ["vendido"] },
    ],
    [],
  );

  const filteredLeads = useMemo(() => {
    // 1) Excluir consignaciones: solo mostrar leads creados como "Leads" (no los que vienen de Consignaciones).
    // 2) Excluir perdidos: los vendidos ahora se muestran en "NEGOCIO CONCRETADO".
    const onlyLeads = leads.filter((lead) => {
      const tags = normalizeTags(lead.tags);
      const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
      if (isConsignacion) return false;
      const st = (lead.status || "").toLowerCase();
      if (st === "perdido") return false;
      return true;
    });

    // 3) Aplicar búsqueda por nombre / teléfono / correo sobre ese subconjunto.
    const q = searchQuery.trim().toLowerCase();
    if (!q) return onlyLeads;
    return onlyLeads.filter((lead) => {
      const name = (lead.full_name || "").toLowerCase();
      const phone = (lead.phone || "").replace(/\D/g, "");
      const phoneQuery = q.replace(/\D/g, "");
      const email = (lead.email || "").toLowerCase();
      return name.includes(q) || email.includes(q) || (phoneQuery.length >= 3 && phone.includes(phoneQuery));
    });
  }, [leads, searchQuery]);

  const leadsByStage = useMemo(() => {
    return stages.map((stage) => ({
      ...stage,
      leads: filteredLeads.filter((lead) => stage.statuses.includes(lead.status)),
    }));
  }, [filteredLeads, stages]);

  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStageKey, setDragOverStageKey] = useState<CrmStageKey | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [landedLeadId, setLandedLeadId] = useState<string | null>(null);
  const landHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCloseDealDialog, setShowCloseDealDialog] = useState(false);
  const [closeDealLead, setCloseDealLead] = useState<Lead | null>(null);
  const [closeDealVehicle, setCloseDealVehicle] = useState("");
  const [closeDealSaleType, setCloseDealSaleType] = useState<"financiado" | "contado">("contado");
  const [closeDealSellerKey, setCloseDealSellerKey] = useState("");
  const [closeDealSellerOptions, setCloseDealSellerOptions] = useState<CloseDealSellerOption[]>([]);
  const [loadingBranchSellers, setLoadingBranchSellers] = useState(false);
  const [isSubmittingCloseDeal, setIsSubmittingCloseDeal] = useState(false);

  const closeCloseDealDialog = useCallback(() => {
    setShowCloseDealDialog(false);
    setCloseDealLead(null);
    setCloseDealVehicle("");
    setCloseDealSaleType("contado");
    setCloseDealSellerKey("");
    setCloseDealSellerOptions([]);
  }, []);

  const openCloseDealForLead = useCallback(
    (lead: Lead) => {
      setCloseDealLead(lead);
      setCloseDealVehicle(getTagValue(lead.tags, VEHICULO_TAG_PREFIX) || "");
      const pt = (lead.payment_type || "").toLowerCase();
      setCloseDealSaleType(pt.includes("financ") ? "financiado" : "contado");
      const aid = lead.assigned_to;
      if (aid) setCloseDealSellerKey(closeDealSellerKeyUser(aid));
      else setCloseDealSellerKey("");
      setShowCloseDealDialog(true);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (landHighlightTimerRef.current) clearTimeout(landHighlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showCloseDealDialog || !user) return;

    let cancelled = false;
    setLoadingBranchSellers(true);
    const assignedId = closeDealLead?.assigned_to;

    void (async () => {
      const merged: CloseDealSellerOption[] = [];

      if (user.branch_id) {
        const { data, error } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("branch_id", user.branch_id)
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (cancelled) return;

        if (error) {
          console.error("CRM: vendedores sucursal", error);
          if (assignedId && assignedId !== user.id) {
            merged.push({ key: closeDealSellerKeyUser(assignedId), label: "Vendedor asignado al lead" });
          }
        } else {
          const rows = data || [];
          for (const r of rows) {
            if (user.id && r.id === user.id) continue;
            merged.push({ key: closeDealSellerKeyUser(r.id), label: r.full_name });
          }
          if (assignedId && assignedId !== user.id && !merged.some((r) => r.key === closeDealSellerKeyUser(assignedId))) {
            merged.push({ key: closeDealSellerKeyUser(assignedId), label: "Vendedor asignado al lead" });
          }
        }
      } else if (assignedId && assignedId !== user.id) {
        merged.push({ key: closeDealSellerKeyUser(assignedId), label: "Vendedor asignado al lead" });
      }

      if (user.tenant_id) {
        let staffQ = supabase
          .from("branch_sales_staff")
          .select("id, full_name")
          .eq("tenant_id", user.tenant_id)
          .eq("is_active", true);
        if (user.branch_id) {
          staffQ = staffQ.or(`branch_id.eq.${user.branch_id},branch_id.is.null`);
        }
        const { data: staffRows, error: staffErr } = await staffQ.order("full_name", { ascending: true });
        if (cancelled) return;
        if (!staffErr && staffRows?.length) {
          for (const s of staffRows) {
            merged.push({ key: closeDealSellerKeyStaff(s.id), label: s.full_name });
          }
        }
      }

      if (cancelled) return;
      const withoutSelf = user.id
        ? merged.filter((o) => o.key !== closeDealSellerKeyUser(user.id))
        : merged;
      setCloseDealSellerOptions(withoutSelf);
      setLoadingBranchSellers(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [showCloseDealDialog, user, closeDealLead?.assigned_to]);

  useEffect(() => {
    if (!showCloseDealDialog || loadingBranchSellers || closeDealSellerOptions.length === 0) return;
    const valid = closeDealSellerOptions.some((o) => o.key === closeDealSellerKey);
    if (!closeDealSellerKey || !valid) {
      setCloseDealSellerKey(closeDealSellerOptions[0].key);
    }
  }, [showCloseDealDialog, loadingBranchSellers, closeDealSellerOptions, closeDealSellerKey]);

  const handleLeadDragStart = useCallback((e: DragEvent, leadId: string) => {
    const el = e.currentTarget as HTMLElement;
    const w = el.offsetWidth;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.cssText = [
      "position:fixed",
      "left:-9999px",
      "top:0",
      `width:${w}px`,
      "opacity:0.94",
      "box-shadow:0 22px 50px -14px rgba(0,0,0,0.32)",
      "border-radius:0.5rem",
      "pointer-events:none",
      "z-index:100000",
    ].join(";");
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, Math.round(Math.min(w / 2, 140)), 32);
    window.setTimeout(() => clone.remove(), 0);

    e.dataTransfer.setData(DRAG_LEAD_MIME, leadId);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", leadId);
    } catch {
      /* algunos navegadores son estrictos con tipos MIME */
    }
    setDraggingLeadId(leadId);
  }, []);

  const handleLeadDragEnd = useCallback(() => {
    setDraggingLeadId(null);
    setDragOverStageKey(null);
  }, []);

  const handleStageDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleStageDrop = useCallback(
    async (e: DragEvent, stageKey: CrmStageKey, stageStatuses: string[]) => {
      e.preventDefault();
      setDragOverStageKey(null);
      const leadId =
        e.dataTransfer.getData(DRAG_LEAD_MIME) || e.dataTransfer.getData("text/plain").trim();
      if (!leadId) {
        setDraggingLeadId(null);
        return;
      }

      const lead = filteredLeads.find((l) => l.id === leadId);
      if (!lead) {
        setDraggingLeadId(null);
        return;
      }

      if (stageStatuses.includes(lead.status)) {
        setDraggingLeadId(null);
        return;
      }

      const nextStatus = pipelineDbStatusForStage(stageKey);
      if (lead.status === nextStatus) {
        setDraggingLeadId(null);
        return;
      }

      if (stageKey === "negocio_cerrado") {
        openCloseDealForLead(lead);
        setDraggingLeadId(null);
        return;
      }

      setMovingLeadId(leadId);
      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((l: Lead) => (l.id === leadId ? { ...l, status: nextStatus } : l));
      });

      try {
        const updated = await leadService.update(leadId, { status: nextStatus as Lead["status"] });
        queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
          if (!Array.isArray(current)) return current;
          return current.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));
        });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        if (landHighlightTimerRef.current) clearTimeout(landHighlightTimerRef.current);
        setLandedLeadId(leadId);
        landHighlightTimerRef.current = setTimeout(() => {
          setLandedLeadId(null);
          landHighlightTimerRef.current = null;
        }, 700);
      } catch (err) {
        console.error(err);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast({
          title: "No se pudo mover el lead",
          description: err instanceof Error ? err.message : "Intenta de nuevo.",
          variant: "destructive",
        });
      } finally {
        setMovingLeadId(null);
        setDraggingLeadId(null);
      }
    },
    [filteredLeads, queryClient, openCloseDealForLead],
  );

  const handleConfirmCloseDeal = useCallback(async () => {
    if (!closeDealLead) return;
    const vehicle = closeDealVehicle.trim();
    if (!vehicle) {
      toast({
        title: "Falta el vehículo",
        description: "Indica qué vehículo se vendió antes de cerrar el negocio.",
        variant: "destructive",
      });
      return;
    }
    const sellerParsed = parseCloseDealSellerKey(closeDealSellerKey);
    if (!sellerParsed) {
      toast({
        title: "Falta el vendedor",
        description: "Selecciona quién cerró la venta.",
        variant: "destructive",
      });
      return;
    }

    const paymentLabel = closeDealSaleType === "financiado" ? "Financiado" : "Contado";
    const leadId = closeDealLead.id;
    const nextTags = buildTagsWithVehicle(closeDealLead.tags, vehicle);

    setIsSubmittingCloseDeal(true);
    setMovingLeadId(leadId);
    const assignedToAfter =
      sellerParsed.kind === "user" ? sellerParsed.id : closeDealLead.assigned_to ?? null;
    const closedByStaffAfter = sellerParsed.kind === "staff" ? sellerParsed.id : null;

    queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
      if (!Array.isArray(current)) return current;
      return current.map((l: Lead) =>
        l.id === leadId
          ? {
              ...l,
              status: "vendido",
              payment_type: paymentLabel,
              assigned_to: assignedToAfter,
              closed_by_staff_id: closedByStaffAfter,
              tags: nextTags,
            }
          : l,
      );
    });

    try {
      const updated = await leadService.update(leadId, {
        status: "vendido",
        payment_type: paymentLabel,
        assigned_to: assignedToAfter,
        closed_by_staff_id: closedByStaffAfter,
        tags: nextTags,
      });
      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (landHighlightTimerRef.current) clearTimeout(landHighlightTimerRef.current);
      setLandedLeadId(leadId);
      landHighlightTimerRef.current = setTimeout(() => {
        setLandedLeadId(null);
        landHighlightTimerRef.current = null;
      }, 700);
      closeCloseDealDialog();
      toast({
        title: "Negocio concretado",
        description: "El lead pasó a vendido con los datos registrados.",
      });
    } catch (err) {
      console.error(err);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "No se pudo cerrar el negocio",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingCloseDeal(false);
      setMovingLeadId(null);
    }
  }, [
    closeCloseDealDialog,
    closeDealLead,
    closeDealSaleType,
    closeDealSellerKey,
    closeDealVehicle,
    queryClient,
  ]);

  return (
    <div className="space-y-6">
      {leadsError && (
        <div
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          No se pudieron cargar los leads.{" "}
          {leadsError instanceof Error ? leadsError.message : "Revisa tu conexión e intenta de nuevo."}
          <Button variant="outline" size="sm" className="ml-3 align-middle" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground mt-2">
            Gestión de clientes y relaciones
          </p>
          <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
            Arrastra una tarjeta a otra columna para cambiar el estado. Al mover a{" "}
            <span className="font-medium">NEGOCIO CONCRETADO</span> se pedirán datos de la venta antes de guardar.
          </p>
        </div>
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre, teléfono o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Buscar cliente en el CRM"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {leadsByStage.map((stage) => {
          const style = stageStyles[stage.key];

          return (
            <Card
              key={stage.key}
              className={cn(
                `border-t-4 transition-shadow duration-200 ${style?.border || ""}`,
                dragOverStageKey === stage.key &&
                  draggingLeadId &&
                  "shadow-lg shadow-primary/10 ring-1 ring-primary/25",
              )}
            >
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
                <div
                  className={cn(
                    "space-y-3 min-h-[180px] rounded-xl p-1 transition-all duration-200",
                    dragOverStageKey === stage.key &&
                      draggingLeadId &&
                      "bg-primary/[0.06] outline outline-2 outline-dashed outline-primary/30 -outline-offset-2",
                  )}
                  onDragOver={(e) => {
                    handleStageDragOver(e);
                    if (draggingLeadId) setDragOverStageKey(stage.key);
                  }}
                  onDrop={(e) => void handleStageDrop(e, stage.key, stage.statuses)}
                >
                  {loading ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Cargando leads...
                    </p>
                  ) : stage.leads.length === 0 ? (
                    <p
                      className={cn(
                        "text-sm text-center py-8 rounded-lg pointer-events-none select-none transition-colors",
                        draggingLeadId
                          ? "text-primary/80 font-medium bg-primary/[0.04] border border-dashed border-primary/25"
                          : "text-muted-foreground",
                      )}
                    >
                      {draggingLeadId ? "Suelta aquí" : "No hay leads en esta etapa"}
                    </p>
                  ) : (
                    stage.leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        draggable={!loading && movingLeadId !== lead.id}
                        isDragging={draggingLeadId === lead.id}
                        justLanded={landedLeadId === lead.id}
                        onDragStart={(e) => handleLeadDragStart(e, lead.id)}
                        onDragEnd={handleLeadDragEnd}
                        onClick={() => openEditDialog(lead)}
                        onExternalDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          if (draggingLeadId) setDragOverStageKey(stage.key);
                        }}
                        onExternalDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleStageDrop(e, stage.key, stage.statuses);
                        }}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={showCloseDealDialog}
        onOpenChange={(open) => {
          if (!open && !isSubmittingCloseDeal) closeCloseDealDialog();
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Cerrar negocio</DialogTitle>
            <DialogDescription>
              {closeDealLead
                ? `Completa la venta para ${closeDealLead.full_name || "este lead"} antes de moverlo a NEGOCIO CONCRETADO.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {closeDealLead && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="close-deal-vehicle">Vehículo vendido</Label>
                <Input
                  id="close-deal-vehicle"
                  value={closeDealVehicle}
                  onChange={(e) => setCloseDealVehicle(e.target.value)}
                  placeholder="Ej: Toyota Corolla 2020"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label>Forma de venta</Label>
                <Select value={closeDealSaleType} onValueChange={(v) => setCloseDealSaleType(v as "financiado" | "contado")}>
                  <SelectTrigger id="close-deal-sale-type">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">Contado</SelectItem>
                    <SelectItem value="financiado">Financiado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Vendedor</Label>
                <Select
                  value={closeDealSellerKey || undefined}
                  onValueChange={setCloseDealSellerKey}
                  disabled={loadingBranchSellers || closeDealSellerOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingBranchSellers
                          ? "Cargando vendedores..."
                          : closeDealSellerOptions.length === 0
                            ? "Sin vendedores disponibles"
                            : "Selecciona vendedor"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {closeDealSellerOptions.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeCloseDealDialog} disabled={isSubmittingCloseDeal}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmCloseDeal()}
              disabled={
                isSubmittingCloseDeal ||
                !closeDealVehicle.trim() ||
                !closeDealSellerKey ||
                loadingBranchSellers
              }
            >
              {isSubmittingCloseDeal ? "Guardando..." : "Confirmar y cerrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      value={safePipelineSelectValue(editForm.status)}
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
                    <Select value={safePipelineSelectValue(leadStatus)} onValueChange={setLeadStatus}>
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
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2 order-2 sm:order-1">
              {editingLead && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteLead}
                  disabled={isUpdating || isDeleting}
                  className="gap-2"
                  aria-label="Eliminar lead"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeleting ? "Eliminando..." : "Eliminar lead"}
                </Button>
              )}
            </div>
            <div className="flex gap-2 order-1 sm:order-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
