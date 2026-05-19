import { Badge } from "@/components/ui/badge";
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
import { CrmPipelineMoveBanner, type CrmPipelineMoveNotice } from "@/components/crm/CrmPipelineMoveBanner";
import { LeadCrmQuickAppointmentPicker } from "@/components/crm/LeadCrmQuickAppointmentPicker";
import { LeadNotesSection } from "@/components/crm/LeadNotesSection";
import { AssignLeadMenu } from "@/components/leads/AssignLeadMenu";
import { LeadTransmissionSelect } from "@/components/leads/LeadTransmissionSelect";
import { ContactAttemptsBar } from "@/components/leads/ContactAttemptsBar";
import { useBranchSellers } from "@/hooks/useBranchSellers";
import { VendorLoginGate } from "@/components/VendorLoginGate";
import { useLeads } from "@/hooks/useLeads";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { resolveAssigneeBorderColor } from "@/lib/crmAssigneeColor";
import {
  formatLeadCitaDisplayLine,
  pickActiveCrmLeadQuickAppointment,
  type AppointmentRow,
} from "@/lib/crmLeadQuickAppointment";
import {
  CRM_PIPELINE_ACTIVE_DB_STATUSES,
  CRM_PIPELINE_STAGES,
  CRM_PIPELINE_STATUS_LABELS,
  type CrmStageKey,
  crmStageToDbStatus,
  getLeadCrmStageKey,
  leadBelongsToCrmStage,
  safePipelineSelectValue,
} from "@/lib/crmPipeline";
import { CRM_SEGUIMIENTO_SOCIOS, isCrmSeguimientoSocio, seguimientoSocioPillClass } from "@/lib/crmSeguimientoSocio";
import { leadTransmissionForForm, leadTransmissionForSave } from "@/lib/leadTransmission";
import { leadsAssignedToForQuery } from "@/lib/leadsScope";
import { notifyDealClosed } from "@/lib/notifications/dealClosed";
import { appointmentService } from "@/lib/services/appointments";
import { leadService } from "@/lib/services/leads";
import { saleService } from "@/lib/services/sales";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, CheckCircle2, ChevronDown, ChevronUp, Eye, Pencil, Search, Target, TrendingUp, Trash2, Users, X, PhoneOff, ArrowUpRight, Skull } from "lucide-react";
import type { DragEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Link, useLocation } from "react-router-dom";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

type LeadWithAssignee = Lead & {
  assigned_user?: { id?: string; full_name?: string | null; email?: string | null; crm_color?: string | null } | null;
};

const CRM_UNASSIGNED_VALUE = "__crm_sin_asignar__";

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

const statusLabels = CRM_PIPELINE_STATUS_LABELS;

const ACTIVE_PIPELINE_STATUS_ES: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Interesado",
  cotizando: "Cotizando",
  negociando: "Negociando",
  en_espera: "En espera",
  para_cierre: "Para cierre",
};

/** MIME para DataTransfer (evita colisiones con texto plano). */
const DRAG_LEAD_MIME = "application/x-skale-lead-id";

const stageStyles: Record<CrmStageKey, { border: string; badge: string; dot?: string }> = {
  contactado: { border: "border-blue-500", badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  negociando: { border: "border-orange-500", badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  en_espera: { border: "border-violet-500", badge: "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300", dot: "bg-violet-500" },
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

/** Filas de datos del lead para mostrar en la tarjeta del pipeline (sin abrir el diálogo). */
/** Texto unificado del vehículo de interés (columna + tag legacy). */
function getLeadVehicleInterestText(lead: Pick<Lead, "vehicle_interest" | "tags">): string {
  const raw = (lead.vehicle_interest?.trim() || getTagValue(lead.tags, VEHICULO_TAG_PREFIX)).trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, " ");
}

function leadPipelinePreviewRows(lead: LeadWithAssignee): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, raw?: string | null) => {
    const v = typeof raw === "string" ? raw.trim() : "";
    if (v) rows.push({ label, value: v });
  };
  add("Correo", lead.email);
  add("RUT", lead.rut);
  add("Vehículo", lead.vehicle_interest || getTagValue(lead.tags, VEHICULO_TAG_PREFIX));
  add("Región", lead.region || getTagValue(lead.tags, REGION_TAG_PREFIX));
  add("Financ./Contado", lead.payment_type);
  add("Presupuesto", lead.budget);
  add("Pie", lead.pie_disponible);
  add("Cuotas mens.", lead.cuotas_mensuales);
  add("Transmisión", lead.transmision);
  return rows;
}

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

function formatLeadTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

/** YYYY-MM en calendario local: la columna «Negocio concretado» solo muestra cierres del mes en curso. */
function localCalendarMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function vendidoClosedMonthKey(lead: Lead): string | null {
  if ((lead.status || "").toLowerCase() !== "vendido") return null;
  const raw = lead.closed_at ?? lead.updated_at;
  if (!raw) return null;
  try {
    return localCalendarMonthKey(new Date(raw));
  } catch {
    return null;
  }
}

function isVendidoInLocalCalendarMonth(lead: Lead, monthKey: string): boolean {
  const k = vendidoClosedMonthKey(lead);
  return k !== null && k === monthKey;
}

/**
 * Formatea un error de Supabase/PostgREST en un string legible, combinando
 * message + details + hint + code. Permite ver en el toast la causa real
 * (RLS denegado, CHECK violado, etc.) en vez de un "Intenta de nuevo" genérico.
 */
function describeSupabaseError(err: unknown): string {
  if (!err) return "Intenta de nuevo.";
  const e = err as { message?: string; details?: string; hint?: string; code?: string };
  const parts = [e.message, e.details, e.hint].filter((p): p is string => !!p && p.trim().length > 0);
  const joined = parts.length > 0 ? parts.join(" · ") : err instanceof Error ? err.message : "Intenta de nuevo.";
  return e.code ? `${joined} [${e.code}]` : joined;
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
  lead: LeadWithAssignee;
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
  const [expanded, setExpanded] = useState(false);
  const label = getConsignacionLabel(lead.tags);
  const styles = label ? (labelStyles[label] || labelStyles.sin_etiqueta) : null;
  const hasAiState = lead.state != null && lead.state !== "";
  const lastDragEndRef = useRef(0);
  const attempts = Math.max(0, Math.min(lead.contact_attempts ?? 0, 3));
  const socio = isCrmSeguimientoSocio(lead.crm_seguimiento_socio) ? lead.crm_seguimiento_socio : null;
  const assigneeBorder = socio
    ? null
    : resolveAssigneeBorderColor({
        userId: lead.assigned_to,
        crmColor: lead.assigned_user?.crm_color ?? null,
      });
  /** Semáforo de intentos: visible en columnas activas del pipeline (no en vendido). */
  const showContactAttemptsSemaforo = useMemo(() => {
    const stage = getLeadCrmStageKey(lead.status);
    return (
      stage === "contactado"
      || stage === "negociando"
      || stage === "en_espera"
      || stage === "para_cierre"
    );
  }, [lead.status]);
  const attemptStyles: Record<number, string> = {
    0: "",
    1: "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10",
    2: "border-amber-400 bg-amber-50/70 dark:bg-amber-500/10",
    3: "border-red-500 bg-red-50/70 dark:bg-red-500/10",
  };

  const handleCardOpen = () => {
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
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("[data-crm-card-expand-toggle]")) return;
        if (t.closest("[data-crm-card-open-lead]")) return;
        handleCardOpen();
      }}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleCardOpen()}
      aria-grabbed={isDragging ? true : undefined}
      title={draggable ? "Arrastra a otra columna o haz clic para abrir" : undefined}
      className={cn(
        "group relative rounded-lg border bg-card px-3 py-2 text-sm shadow-sm",
        assigneeBorder && "border-l-[3px]",
        "transition-[transform,opacity,box-shadow,ring] duration-200 ease-out",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        draggable ? "cursor-grab touch-none active:cursor-grabbing hover:bg-muted/40 hover:shadow-md" : "cursor-pointer hover:bg-muted/50",
        showContactAttemptsSemaforo && attemptStyles[attempts],
        isDragging &&
          "scale-[0.97] border-dashed border-primary/50 bg-muted/50 opacity-[0.42] shadow-none ring-0",
        justLanded && "animate-in zoom-in-95 fade-in duration-300 ring-2 ring-emerald-500/35 shadow-md",
      )}
      style={assigneeBorder ? { borderLeftColor: assigneeBorder } : undefined}
    >
      {socio ? (
        <span
          title={`Seguimiento: ${socio}`}
          className={cn(
            "pointer-events-none absolute right-1 top-1 z-[1] max-w-[4.25rem] truncate rounded px-1 py-px text-center text-[9px] font-semibold leading-tight shadow-sm",
            seguimientoSocioPillClass(socio),
          )}
        >
          {socio}
        </span>
      ) : null}
      <div className={cn("font-medium", socio && "pr-12")}>{lead.full_name || "Sin nombre"}</div>
      <div className="text-muted-foreground text-[13px]">
        {formatChilePhoneForDisplay(lead.phone) || "Sin telefono"}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          {showContactAttemptsSemaforo ? (
            <ContactAttemptsBar
              leadId={lead.id}
              value={lead.contact_attempts ?? 0}
              size="sm"
              showLabel={false}
            />
          ) : (
            <span className="text-xs text-muted-foreground tabular-nums">
              Contactos {attempts}/3
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 transition-opacity duration-200",
            "pointer-events-none opacity-0",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
            "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
          )}
        >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
          data-crm-card-open-lead
          onClick={(e) => {
            e.stopPropagation();
            if (Date.now() - lastDragEndRef.current < 400) return;
            onClick();
          }}
          aria-label="Abrir ficha del lead"
          title="Abrir ficha para ver o editar datos"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-0.5 px-2 text-[11px] font-medium"
          data-crm-card-expand-toggle
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Ocultar
              <ChevronUp className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </>
          ) : (
            <>
              Ver datos
              <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
            </>
          )}
        </Button>
        </div>
      </div>
      {expanded ? (
        <>
          {(() => {
            const previewRows = leadPipelinePreviewRows(lead);
            const notesPreview = lead.notes?.trim() ?? "";
            if (previewRows.length === 0 && !notesPreview) return null;
            return (
              <div className="mt-2 space-y-1 rounded-md border border-border/45 bg-muted/25 px-2 py-1.5 text-[11px] leading-snug">
                {previewRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[minmax(0,5.25rem)_1fr] gap-x-2 items-start">
                    <span className="text-muted-foreground shrink-0">{row.label}</span>
                    <span className="min-w-0 break-words text-foreground/90" title={row.value}>
                      {row.value}
                    </span>
                  </div>
                ))}
                {notesPreview ? (
                  <div className="mt-1 border-t border-border/35 pt-1.5">
                    <span className="text-muted-foreground">Nota</span>
                    <p className="mt-0.5 text-foreground/90 line-clamp-3 whitespace-pre-wrap break-words" title={notesPreview}>
                      {notesPreview}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })()}
          {!socio && (lead.assigned_user?.full_name || lead.assigned_user?.email) && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {assigneeBorder ? (
                <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-border" style={{ backgroundColor: assigneeBorder }} />
              ) : null}
              <span className="truncate">
                Seguimiento: {lead.assigned_user?.full_name || lead.assigned_user?.email}
              </span>
            </div>
          )}
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
        </>
      ) : null}
    </div>
  );
});

const CAN_SUPERVISE = new Set(["admin", "gerente", "jefe_jefe", "jefe_sucursal", "financiero"]);

export default function CRM() {
  const { user } = useAuth();
  const location = useLocation();
  const vendorMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("vendor") === "1";
  }, [location.search]);

  const queryClient = useQueryClient();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const { leads, loading, error: leadsError, refetch } = useLeads({
    branchId: user?.branch_id ?? undefined,
    assignedTo: leadsAssignedToForQuery(user?.role, user?.id),
    enabled: !!user,
  });

  const { data: deletedLeads = [] } = useQuery({
    queryKey: ["leads", "deleted"],
    queryFn: () => leadService.getDeleted(),
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  });

  const canSupervise = !!user?.role && CAN_SUPERVISE.has(user.role);
  const [supervisedVendorId, setSupervisedVendorId] = useState<string | null>(null);

  const { sellers: vendorList } = useBranchSellers({
    tenantId: user?.tenant_id ?? null,
    branchId: canSupervise && !["admin","gerente","jefe_jefe","financiero"].includes(user?.role ?? "")
      ? (user?.branch_id ?? null)
      : null,
    scope: ["admin","gerente","jefe_jefe","financiero"].includes(user?.role ?? "") ? "tenant" : "branch",
    roles: ["vendedor"],
    enabled: canSupervise,
  });

  const supervisedVendorName = useMemo(
    () => vendorList.find((v) => v.id === supervisedVendorId)?.full_name ?? null,
    [vendorList, supervisedVendorId],
  );

  const [crmCalendarMonthKey, setCrmCalendarMonthKey] = useState(() => localCalendarMonthKey(new Date()));

  useEffect(() => {
    const syncMonth = () => {
      const next = localCalendarMonthKey(new Date());
      setCrmCalendarMonthKey((prev) => (prev === next ? prev : next));
    };
    const id = window.setInterval(syncMonth, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") syncMonth();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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
    pie: "",
    cuotas_mensuales: "",
    vehicle: "",
    transmision: "",
    status: "contactado",
    /** Vendedor que hace el seguimiento (`leads.assigned_to`) */
    assigned_to: null as string | null,
    /** Mike / Antonio / Jota (`leads.crm_seguimiento_socio`) */
    crm_seguimiento_socio: null as "Mike" | "Antonio" | "Jota" | null,
    /** Día de cita rápida (`yyyy-MM-dd`) sincronizado con `appointments`. */
    citaDayKey: null as string | null,
    crmQuickAppointmentId: null as string | null,
  });

  const editCitaSyncedRef = useRef(false);

  const crmQuickAppointmentQuery = useQuery({
    queryKey: ["crmLeadQuickAppointment", editingLead?.id],
    enabled: Boolean(showEditDialog && editingLead?.id && user?.tenant_id),
    queryFn: async () => {
      const rows = await appointmentService.getAll({ leadId: editingLead!.id });
      return pickActiveCrmLeadQuickAppointment(rows as AppointmentRow[]);
    },
  });

  useEffect(() => {
    if (!isEditingForm) {
      editCitaSyncedRef.current = false;
      return;
    }
    if (!editingLead?.id) return;
    if (!crmQuickAppointmentQuery.isFetched) return;
    if (editCitaSyncedRef.current) return;
    editCitaSyncedRef.current = true;

    const appt = crmQuickAppointmentQuery.data ?? null;
    setEditForm((f) => {
      if (!appt) {
        return { ...f, citaDayKey: null, crmQuickAppointmentId: null };
      }
      const dayKey = format(parseISO(appt.scheduled_at), "yyyy-MM-dd");
      return { ...f, citaDayKey: dayKey, crmQuickAppointmentId: appt.id };
    });
  }, [
    isEditingForm,
    editingLead?.id,
    crmQuickAppointmentQuery.isFetched,
    crmQuickAppointmentQuery.data?.id,
    crmQuickAppointmentQuery.data?.scheduled_at,
  ]);
  const { sellers: crmAssigneeOptions } = useBranchSellers({
    tenantId: user?.tenant_id ?? null,
    scope: "tenant",
    roles: ["vendedor", "jefe_sucursal"],
    enabled: !!user?.tenant_id && showEditDialog && isEditingForm,
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

  const openEditDialog = useCallback((lead: LeadWithAssignee) => {
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
    const ok = await askConfirm({
      title: "¿Eliminar este lead?",
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
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
    editCitaSyncedRef.current = false;
    setEditForm({
      full_name: editingLead.full_name || "",
      phone: (editingLead.phone || "").replace(/^(\+56\s*)/g, ""),
      email: editingLead.email || "",
      region: editingLead.region || getTagValue(editingLead.tags, REGION_TAG_PREFIX) || "",
      payment_type: editingLead.payment_type || "",
      budget: editingLead.budget || "",
      pie: editingLead.pie_disponible || "",
      cuotas_mensuales: editingLead.cuotas_mensuales || "",
      vehicle: getTagValue(editingLead.tags, VEHICULO_TAG_PREFIX) || "",
      transmision: leadTransmissionForForm(editingLead.transmision),
      status: safePipelineSelectValue(editingLead.status),
      assigned_to: editingLead.assigned_to ?? null,
      crm_seguimiento_socio: isCrmSeguimientoSocio(editingLead.crm_seguimiento_socio)
        ? editingLead.crm_seguimiento_socio
        : null,
      citaDayKey: null,
      crmQuickAppointmentId: null,
    });
    setLeadStatus(safePipelineSelectValue(editingLead.status));
    setIsEditingForm(true);
  }, [editingLead]);

  const stages = CRM_PIPELINE_STAGES;

  /**
   * Métricas globales del CRM. Se calculan sobre TODOS los leads del usuario
   * (excluyendo consignaciones — leads que vinieron del flujo de consignación).
   * Se aplica también el filtro de supervisión si está activo, para que las
   * métricas reflejen lo que el usuario ve en el pipeline.
   *
   * Efectividad de cierre = vendidos / (vendidos + perdidos + en pipeline)
   * Es decir: del total de leads trabajados, qué % terminó cerrado.
   */
  const metrics = useMemo(() => {
    const base = leads.filter((lead) => {
      const tags = normalizeTags(lead.tags);
      if (tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX))) return false;
      if (supervisedVendorId && lead.assigned_to !== supervisedVendorId) return false;
      return true;
    });
    const total = base.length;
    const cerrados = base.filter((l) => (l.status || "").toLowerCase() === "vendido").length;
    const cerradosMes = base.filter((l) => isVendidoInLocalCalendarMonth(l, crmCalendarMonthKey)).length;
    const perdidos = base.filter((l) => (l.status || "").toLowerCase() === "perdido").length;
    const enPipeline = total - cerrados - perdidos;
    const efectividad = total > 0 ? Math.round((cerrados / total) * 1000) / 10 : 0;
    const noRespondieron = deletedLeads.filter((lead) => {
      const tags = normalizeTags(lead.tags);
      if (tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX))) return false;
      if (supervisedVendorId && lead.assigned_to !== supervisedVendorId) return false;
      const st = (lead.status || "").toLowerCase();
      return st === "nuevo" || st === "contactado" || st === "interesado";
    }).length;
    const tasaNoRespondieron = total + noRespondieron > 0
      ? Math.round((noRespondieron / (total + noRespondieron)) * 1000) / 10
      : 0;
    const avanzados = base.filter((lead) => {
      const st = (lead.status || "").toLowerCase();
      return st === "negociando" || st === "cotizando" || st === "en_espera" || st === "para_cierre" || st === "vendido" || st === "perdido";
    }).length;
    const tasaAvanceNegociando = total + noRespondieron > 0
      ? Math.round((avanzados / (total + noRespondieron)) * 1000) / 10
      : 0;

    const tasaPerdida = cerrados + perdidos > 0
      ? Math.round((perdidos / (cerrados + perdidos)) * 1000) / 10
      : 0;

    return {
      total,
      cerrados,
      cerradosMes,
      perdidos,
      enPipeline,
      efectividad,
      noRespondieron,
      tasaNoRespondieron,
      avanzados,
      tasaAvanceNegociando,
      tasaPerdida,
    };
  }, [leads, supervisedVendorId, deletedLeads, crmCalendarMonthKey]);

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

    // 3) Filtro de supervisión: si hay un vendedor seleccionado, solo sus leads.
    const supervised = supervisedVendorId
      ? onlyLeads.filter((lead) => lead.assigned_to === supervisedVendorId)
      : onlyLeads;

    // 4) Aplicar búsqueda por nombre / teléfono / correo sobre ese subconjunto.
    const q = searchQuery.trim().toLowerCase();
    if (!q) return supervised;
    return supervised.filter((lead) => {
      const name = (lead.full_name || "").toLowerCase();
      const phone = (lead.phone || "").replace(/\D/g, "");
      const phoneQuery = q.replace(/\D/g, "");
      const email = (lead.email || "").toLowerCase();
      return name.includes(q) || email.includes(q) || (phoneQuery.length >= 3 && phone.includes(phoneQuery));
    });
  }, [leads, searchQuery, supervisedVendorId]);

  const leadsByStage = useMemo(() => {
    const maxedOut = (lead: Lead) => (lead.contact_attempts ?? 0) >= 3;
    return stages.map((stage) => ({
      ...stage,
      leads: filteredLeads
        .filter((lead) => {
          if (!leadBelongsToCrmStage(lead.status, stage.key)) return false;
          if (stage.key === "negocio_cerrado") {
            return isVendidoInLocalCalendarMonth(lead, crmCalendarMonthKey);
          }
          return true;
        })
        .slice()
        .sort((a, b) => {
          const aMax = maxedOut(a) ? 1 : 0;
          const bMax = maxedOut(b) ? 1 : 0;
          return aMax - bMax;
        }),
    }));
  }, [filteredLeads, stages, crmCalendarMonthKey]);

  /** Demanda de stock: agrupa vehículo de interés en leads activos del embudo (respeta búsqueda y supervisión). */
  const vehicleDemandSummary = useMemo(() => {
    const base = filteredLeads.filter((lead) =>
      CRM_PIPELINE_ACTIVE_DB_STATUSES.has((lead.status || "").toLowerCase()),
    );
    const bucket = new Map<string, number>();
    let sinVehiculo = 0;
    for (const lead of base) {
      const v = getLeadVehicleInterestText(lead);
      if (!v) {
        sinVehiculo += 1;
        continue;
      }
      bucket.set(v, (bucket.get(v) ?? 0) + 1);
    }
    const entries = [...bucket.entries()]
      .map(([vehicle, count]) => ({ vehicle, count }))
      .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.vehicle.localeCompare(b.vehicle, "es")));
    return { entries, sinVehiculo, pipelineCount: base.length };
  }, [filteredLeads]);

  const [demandVehicleInterestKey, setDemandVehicleInterestKey] = useState<string | null>(null);

  const leadsForDemandInterest = useMemo(() => {
    if (!demandVehicleInterestKey) return [] as LeadWithAssignee[];
    return filteredLeads.filter((lead) => {
      if (!CRM_PIPELINE_ACTIVE_DB_STATUSES.has((lead.status || "").toLowerCase())) return false;
      return getLeadVehicleInterestText(lead) === demandVehicleInterestKey;
    });
  }, [filteredLeads, demandVehicleInterestKey]);

  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStageKey, setDragOverStageKey] = useState<CrmStageKey | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [landedLeadId, setLandedLeadId] = useState<string | null>(null);
  const landHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pipelineMoveNotice, setPipelineMoveNotice] = useState<CrmPipelineMoveNotice | null>(null);
  const pipelineMoveNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissPipelineMoveNotice = useCallback(() => {
    if (pipelineMoveNoticeTimerRef.current) {
      clearTimeout(pipelineMoveNoticeTimerRef.current);
      pipelineMoveNoticeTimerRef.current = null;
    }
    setPipelineMoveNotice(null);
  }, []);

  const showPipelineMoveNotice = useCallback(
    (lead: Lead, fromStatus: string | null | undefined, toStage: CrmStageKey) => {
      const fromStage = getLeadCrmStageKey(fromStatus) ?? toStage;
      if (fromStage === toStage) return;

      if (pipelineMoveNoticeTimerRef.current) {
        clearTimeout(pipelineMoveNoticeTimerRef.current);
      }

      setPipelineMoveNotice({
        id: crypto.randomUUID(),
        leadName: lead.full_name?.trim() || "Sin nombre",
        fromStage,
        toStage,
      });

      pipelineMoveNoticeTimerRef.current = setTimeout(() => {
        setPipelineMoveNotice(null);
        pipelineMoveNoticeTimerRef.current = null;
      }, 4800);
    },
    [],
  );

  const [showCloseDealDialog, setShowCloseDealDialog] = useState(false);
  const [closeDealLead, setCloseDealLead] = useState<Lead | null>(null);
  const [closeDealVehicle, setCloseDealVehicle] = useState("");
  const [closeDealSaleType, setCloseDealSaleType] = useState<"financiado" | "contado">("contado");
  const [closeDealSellerKey, setCloseDealSellerKey] = useState("");
  const [closeDealPrice, setCloseDealPrice] = useState("");
  const [closeDealSellerOptions, setCloseDealSellerOptions] = useState<CloseDealSellerOption[]>([]);
  const [loadingBranchSellers, setLoadingBranchSellers] = useState(false);
  const [isSubmittingCloseDeal, setIsSubmittingCloseDeal] = useState(false);

  const closeCloseDealDialog = useCallback(() => {
    setShowCloseDealDialog(false);
    setCloseDealLead(null);
    setCloseDealVehicle("");
    setCloseDealSaleType("contado");
    setCloseDealSellerKey("");
    setCloseDealPrice("");
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
      setCloseDealPrice("");
      setShowCloseDealDialog(true);
    },
    [],
  );

  const handleUpdateLead = useCallback(async () => {
    if (!editingLead) return;

    const targetStageKey = (isEditingForm ? editForm.status : leadStatus) as CrmStageKey;
    const currentStageKey = getLeadCrmStageKey(editingLead.status);
    if (
      targetStageKey === "negocio_cerrado"
      && currentStageKey !== "negocio_cerrado"
    ) {
      openCloseDealForLead(editingLead);
      return;
    }

    setIsUpdating(true);
    try {
      const updates: Record<string, unknown> = isEditingForm
        ? {
            full_name: toTitleCase(editForm.full_name.trim()) || "Sin nombre",
            phone: normalizePhoneChile(editForm.phone) || "sin_telefono",
            email: editForm.email.trim() || null,
            status: crmStageToDbStatus(editForm.status),
            region: editForm.region.trim() || null,
            payment_type: editForm.payment_type.trim() || null,
            budget: editForm.budget.trim() || null,
            pie_disponible: editForm.pie.trim() || null,
            cuotas_mensuales: editForm.cuotas_mensuales.trim() || null,
            transmision: leadTransmissionForSave(editForm.transmision),
            tags: buildTagsWithVehicle(editingLead.tags, editForm.vehicle),
            assigned_to: editForm.assigned_to,
            crm_seguimiento_socio: editForm.crm_seguimiento_socio,
          }
        : { status: crmStageToDbStatus(leadStatus) };

      const updated = await leadService.update(editingLead.id, updates as any);

      if (isEditingForm) {
        await appointmentService.upsertCrmLeadQuickAppointment({
          leadId: editingLead.id,
          leadDisplayName: editForm.full_name.trim() || editingLead.full_name || "Lead",
          tenantId: editingLead.tenant_id ?? user?.tenant_id ?? null,
          branchId: editingLead.branch_id ?? user?.branch_id ?? null,
          userId: user?.id ?? null,
          existingId: editForm.crmQuickAppointmentId,
          dayKey: editForm.citaDayKey,
        });
        await queryClient.invalidateQueries({ queryKey: ["appointments"] });
        await queryClient.invalidateQueries({ queryKey: ["crmLeadQuickAppointment", editingLead.id] });
      }

      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead));
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (isEditingForm) {
        setEditingLead(updated as Lead);
        setIsEditingForm(false);
        if (editForm.citaDayKey) {
          toast({
            title: "Cita guardada",
            description: `${formatLeadCitaDisplayLine(
              new Date(
                `${editForm.citaDayKey}T10:00:00`,
              ).toISOString(),
            )} · visible en Citas`,
          });
        }
      } else {
        closeEditDialog();
      }
    } catch (error: unknown) {
      console.error("[CRM] handleUpdateLead", { leadId: editingLead.id, isEditingForm, error });
      toast({
        title: "No se pudo actualizar el lead",
        description: describeSupabaseError(error),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }, [
    editingLead,
    leadStatus,
    isEditingForm,
    editForm,
    queryClient,
    closeEditDialog,
    openCloseDealForLead,
    user?.id,
    user?.tenant_id,
    user?.branch_id,
  ]);

  useEffect(() => {
    return () => {
      if (landHighlightTimerRef.current) clearTimeout(landHighlightTimerRef.current);
      if (pipelineMoveNoticeTimerRef.current) clearTimeout(pipelineMoveNoticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showCloseDealDialog || !user) return;

    let cancelled = false;
    setLoadingBranchSellers(true);
    const assignedId = closeDealLead?.assigned_to;

    void (async () => {
      const merged: CloseDealSellerOption[] = [];
      const isVendedor = user.role === "vendedor";

      if (!isVendedor && user.branch_id) {
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
      } else if (!isVendedor && assignedId && assignedId !== user.id) {
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
    async (e: DragEvent, stageKey: CrmStageKey) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverStageKey(null);

      const leadId =
        e.dataTransfer.getData(DRAG_LEAD_MIME) || e.dataTransfer.getData("text/plain").trim();
      if (!leadId) {
        setDraggingLeadId(null);
        return;
      }

      const lead = leads.find((l) => l.id === leadId) ?? filteredLeads.find((l) => l.id === leadId);
      if (!lead) {
        setDraggingLeadId(null);
        toast({
          title: "No se encontró el lead",
          description: "Actualiza la página e intenta mover la tarjeta de nuevo.",
          variant: "destructive",
        });
        return;
      }

      if (leadBelongsToCrmStage(lead.status, stageKey)) {
        setDraggingLeadId(null);
        return;
      }

      if (stageKey === "negocio_cerrado") {
        openCloseDealForLead(lead);
        setDraggingLeadId(null);
        return;
      }

      const nextStatus = crmStageToDbStatus(stageKey) as Lead["status"];
      const previousStatus = lead.status;
      setMovingLeadId(leadId);
      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((l: Lead) => (l.id === leadId ? { ...l, status: nextStatus } : l));
      });

      try {
        const updated = await leadService.update(leadId, { status: nextStatus });
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
        showPipelineMoveNotice(lead, previousStatus, stageKey);
      } catch (err) {
        console.error("[CRM] handleStageDrop", { leadId, from: previousStatus, to: nextStatus, err });
        queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
          if (!Array.isArray(current)) return current;
          return current.map((l: Lead) => (l.id === leadId ? { ...l, status: previousStatus } : l));
        });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast({
          title: "No se pudo mover el lead",
          description: describeSupabaseError(err),
          variant: "destructive",
        });
      } finally {
        setMovingLeadId(null);
        setDraggingLeadId(null);
      }
    },
    [leads, filteredLeads, queryClient, openCloseDealForLead, showPipelineMoveNotice],
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
    if (user?.role === "vendedor" && sellerParsed.kind === "user" && sellerParsed.id !== user.id) {
      toast({
        title: "No permitido",
        description: "Como vendedor solo puedes registrar cierre con vendedores de plantilla (staff) o tu propio usuario.",
        variant: "destructive",
      });
      return;
    }

    const salePrice = Number(String(closeDealPrice).replace(/[^\d]/g, ""));
    if (!salePrice || salePrice <= 0) {
      toast({
        title: "Falta el precio de venta",
        description: "Indica el monto de la venta para actualizar el ranking de vendedores.",
        variant: "destructive",
      });
      return;
    }

    const sellerOption = closeDealSellerOptions.find((o) => o.key === closeDealSellerKey);
    const sellerLabel = sellerOption?.label ?? "";

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

    const previousStatus = closeDealLead.status ?? null;
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
      try {
        await saleService.create({
          lead_id: leadId,
          client_name: closeDealLead.full_name ?? null,
          vehicle_description: vehicle,
          seller_id: sellerParsed.kind === "user" ? sellerParsed.id : null,
          seller_name:
            sellerParsed.kind === "staff"
              ? sellerLabel || null
              : sellerLabel && sellerLabel !== "Vendedor asignado al lead"
                ? sellerLabel
                : null,
          branch_id: updated.branch_id ?? user?.branch_id ?? null,
          tenant_id: updated.tenant_id ?? null,
          sale_price: salePrice,
          payment_method: closeDealSaleType,
          payment_status: "realizado",
          status: "completada",
          sale_date: new Date().toISOString().slice(0, 10),
        });
        queryClient.invalidateQueries({ queryKey: ["sales-ranking"] });
        queryClient.invalidateQueries({ queryKey: ["sales"] });
      } catch (saleErr) {
        console.error("No se pudo registrar la venta para el ranking", saleErr);
        toast({
          title: "Venta no registrada en ranking",
          description:
            "El lead quedó como vendido, pero no se pudo crear la venta en el registro. Contacta a soporte.",
          variant: "destructive",
        });
      }
      notifyDealClosed({
        lead: updated,
        previousStatus,
        vehicleLabel: vehicle,
        actorUserId: user?.id ?? null,
        salePrice,
        sellerName: sellerLabel && sellerLabel !== "Vendedor asignado al lead" ? sellerLabel : null,
      });
      if (landHighlightTimerRef.current) clearTimeout(landHighlightTimerRef.current);
      setLandedLeadId(leadId);
      landHighlightTimerRef.current = setTimeout(() => {
        setLandedLeadId(null);
        landHighlightTimerRef.current = null;
      }, 700);
      closeCloseDealDialog();
      toast({
        title: "Negocio concretado",
        description: `Venta registrada por ${salePrice.toLocaleString("es-CL")} CLP.`,
      });
    } catch (err) {
      console.error("[CRM] handleConfirmCloseDeal", err);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "No se pudo cerrar el negocio",
        description: describeSupabaseError(err),
        variant: "destructive",
      });
    } finally {
      setIsSubmittingCloseDeal(false);
      setMovingLeadId(null);
    }
  }, [
    closeCloseDealDialog,
    closeDealLead,
    closeDealPrice,
    closeDealSaleType,
    closeDealSellerKey,
    closeDealSellerOptions,
    closeDealVehicle,
    queryClient,
    user?.role,
    user?.id,
    user?.branch_id,
  ]);

  if (vendorMode && user?.role !== "vendedor") {
    return (
      <VendorLoginGate
        title="CRM bloqueado"
        description="Inicia sesión con tu usuario de vendedor para ver tu información."
        afterLoginPath="/app/crm"
      />
    );
  }

  return (
    <div className="space-y-6">
      {ConfirmDialog}
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
      {supervisedVendorId && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-400 bg-blue-50 px-4 py-2.5 dark:bg-blue-950/30 dark:border-blue-600">
          <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300 flex-1">
            Supervisando CRM de <span className="font-bold">{supervisedVendorName ?? "Vendedor"}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/40"
            onClick={() => setSupervisedVendorId(null)}
            title="Volver a vista global"
          >
            <X className="h-4 w-4" />
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
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center shrink-0">
          {canSupervise && vendorList.length > 0 && (
            <Select
              value={supervisedVendorId ?? "__all__"}
              onValueChange={(val) => setSupervisedVendorId(val === "__all__" ? null : val)}
            >
              <SelectTrigger className="w-full sm:w-52 gap-2">
                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Ver CRM de vendedor…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Vista global</SelectItem>
                {vendorList.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.full_name || v.email || v.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative w-full sm:w-72">
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total leads</p>
              <p className="text-2xl font-bold leading-tight">{metrics.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-orange-50 p-2 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">En pipeline</p>
              <p className="text-2xl font-bold leading-tight">{metrics.enPipeline}</p>
              <p className="text-[11px] text-muted-foreground">
                Activos sin cerrar
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Concretados (mes)</p>
              <p className="text-2xl font-bold leading-tight">{metrics.cerradosMes}</p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.cerrados} total histórico · {metrics.perdidos} perdido{metrics.perdidos === 1 ? "" : "s"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
              <Target className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Efectividad de cierre</p>
              <p className="text-2xl font-bold leading-tight">
                {metrics.total > 0 ? `${metrics.efectividad.toLocaleString("es-CL")}%` : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.cerrados} de {metrics.total} cerrados
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <PhoneOff className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">No respondieron (sin negociar)</p>
              <p className="text-2xl font-bold leading-tight">
                {(metrics.total + metrics.noRespondieron) > 0
                  ? `${metrics.tasaNoRespondieron.toLocaleString("es-CL")}%`
                  : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.noRespondieron} en papelera
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-sky-50 p-2 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Avance a negociando</p>
              <p className="text-2xl font-bold leading-tight">
                {(metrics.total + metrics.noRespondieron) > 0
                  ? `${metrics.tasaAvanceNegociando.toLocaleString("es-CL")}%`
                  : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.avanzados} llegaron a negociando+
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <Skull className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Tasa de pérdida</p>
              <p className="text-2xl font-bold leading-tight">
                {(metrics.cerrados + metrics.perdidos) > 0
                  ? `${metrics.tasaPerdida.toLocaleString("es-CL")}%`
                  : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.perdidos} de {metrics.cerrados + metrics.perdidos} cerrados/perdidos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Car className="h-4 w-4" aria-hidden />
            </span>
            Vehículos a buscar en stock
          </CardTitle>
          <CardDescription>
            Consolidado desde el campo <span className="font-medium text-foreground/80">vehículo de interés</span> de
            tus clientes en etapas activas del pipeline (contactado → en espera → para cierre). Coincide con la búsqueda y la vista que
            tengas arriba; los vendidos y perdidos no entran aquí.{" "}
            <span className="font-medium text-foreground/80">Clic</span> en una tarjeta para ver la lista de esos leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {vehicleDemandSummary.pipelineCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay leads activos en el embudo con los filtros actuales.
            </p>
          ) : vehicleDemandSummary.entries.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Ningún lead activo tiene aún un vehículo de interés cargado. Completalo en la ficha del lead para armar esta
                lista de búsqueda.
              </p>
              {vehicleDemandSummary.sinVehiculo > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Hay {vehicleDemandSummary.sinVehiculo}{" "}
                  {vehicleDemandSummary.sinVehiculo === 1 ? "lead" : "leads"} sin dato de vehículo.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {vehicleDemandSummary.entries.map(({ vehicle, count }) => (
                  <li
                    key={vehicle}
                    role="button"
                    tabIndex={0}
                    title="Ver leads que buscan esta opción"
                    className="flex min-h-[3rem] cursor-pointer items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => setDemandVehicleInterestKey(vehicle)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDemandVehicleInterestKey(vehicle);
                      }
                    }}
                  >
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">{vehicle}</span>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      ×{count}
                    </Badge>
                  </li>
                ))}
              </ul>
              {vehicleDemandSummary.sinVehiculo > 0 ? (
                <p className="text-xs text-muted-foreground border-t pt-3">
                  Además, {vehicleDemandSummary.sinVehiculo}{" "}
                  {vehicleDemandSummary.sinVehiculo === 1 ? "lead activo no tiene" : "leads activos no tienen"} vehículo
                  indicado — conviene cargarlo para no perder búsquedas.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={demandVehicleInterestKey !== null}
        onOpenChange={(open) => {
          if (!open) setDemandVehicleInterestKey(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leads que buscan esto</DialogTitle>
            <DialogDescription className="sr-only">
              Lista de clientes activos en el pipeline con el mismo texto de vehículo de interés.
            </DialogDescription>
            {demandVehicleInterestKey ? (
              <p className="break-words pt-1 text-sm font-medium text-foreground">{demandVehicleInterestKey}</p>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            {leadsForDemandInterest.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No hay leads en esta lista con los filtros actuales. Prueba cerrar otros filtros o actualizar la página.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado embudo</TableHead>
                    <TableHead>Vendedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsForDemandInterest.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setDemandVehicleInterestKey(null);
                        openEditDialog(lead);
                      }}
                    >
                      <TableCell className="max-w-[160px] font-medium">
                        <span className="line-clamp-2">{lead.full_name}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatChilePhoneForDisplay(lead.phone)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal capitalize">
                          {ACTIVE_PIPELINE_STATUS_ES[(lead.status || "").toLowerCase()] ||
                            lead.status ||
                            "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[130px] truncate text-sm text-muted-foreground">
                        {lead.assigned_user?.full_name || "Sin asignar"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Clic en una fila para abrir la ficha del lead en el CRM.
          </p>

          <DialogFooter className="shrink-0 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDemandVehicleInterestKey(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CrmPipelineMoveBanner notice={pipelineMoveNotice} onDismiss={dismissPipelineMoveNotice} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {leadsByStage.map((stage) => {
          const style = stageStyles[stage.key];

          return (
            <Card
              key={stage.key}
              onDragOver={(e) => {
                handleStageDragOver(e);
                if (draggingLeadId) setDragOverStageKey(stage.key);
              }}
              onDragLeave={(e) => {
                // Solo limpiar cuando salimos de la Card entera, no al pasar entre hijos.
                const next = e.relatedTarget as Node | null;
                if (!next || !(e.currentTarget as HTMLElement).contains(next)) {
                  if (dragOverStageKey === stage.key) setDragOverStageKey(null);
                }
              }}
              onDrop={(e) => void handleStageDrop(e, stage.key)}
              className={cn(
                `border-t-4 transition-shadow duration-200 ${style?.border || ""}`,
                draggingLeadId && "cursor-copy",
                dragOverStageKey === stage.key &&
                  draggingLeadId &&
                  "shadow-lg shadow-primary/10 ring-1 ring-primary/25",
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    {style?.dot && <span className={`h-2 w-2 rounded-full ${style.dot}`} />}
                    {stage.label}
                  </span>
                  <Badge className={style?.badge || ""} variant="secondary">
                    {stage.leads.length}
                  </Badge>
                </CardTitle>
                {stage.key === "negocio_cerrado" ? (
                  <CardDescription className="text-[11px] pt-1">
                    Solo negocios cerrados en el mes en curso (calendario local). Al cambiar de mes, la columna arranca vacía; el resto del embudo no se mueve.
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "space-y-3 min-h-[180px] rounded-xl p-1 transition-all duration-200",
                    dragOverStageKey === stage.key &&
                      draggingLeadId &&
                      "bg-primary/[0.06] outline outline-2 outline-dashed outline-primary/30 -outline-offset-2",
                  )}
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
                          void handleStageDrop(e, stage.key);
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
                <Label htmlFor="close-deal-price">Precio de venta (CLP)</Label>
                <Input
                  id="close-deal-price"
                  inputMode="numeric"
                  value={closeDealPrice}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, "");
                    setCloseDealPrice(digits ? Number(digits).toLocaleString("es-CL") : "");
                  }}
                  placeholder="Ej: 12.500.000"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Este monto suma al ranking de vendedores.
                </p>
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
                !Number(String(closeDealPrice).replace(/[^\d]/g, "")) ||
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
              <div className="flex items-center gap-1 shrink-0">
                <AssignLeadMenu
                  leadId={editingLead.id}
                  assignedTo={editingLead.assigned_to}
                  assignedLabel={(editingLead as Lead & {
                    assigned_user?: { full_name?: string | null; email?: string | null } | null;
                  }).assigned_user?.full_name ?? null}
                  leadBranchId={editingLead.branch_id}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={startEditing}
                  aria-label="Editar datos del lead"
                  title="Editar datos del lead"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
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
                  <div className="grid gap-2">
                    <Label htmlFor="crm-edit-payment">Financiamiento / Contado</Label>
                    <Input
                      id="crm-edit-payment"
                      value={editForm.payment_type}
                      onChange={(e) => setEditForm((f) => ({ ...f, payment_type: e.target.value }))}
                      placeholder="Ej: Contado"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-budget">Presupuesto</Label>
                      <Input
                        id="crm-edit-budget"
                        value={editForm.budget}
                        onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))}
                        placeholder="Ej: 10-12 millones"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-pie">Pie</Label>
                      <Input
                        id="crm-edit-pie"
                        value={editForm.pie}
                        onChange={(e) => setEditForm((f) => ({ ...f, pie: e.target.value }))}
                        placeholder="Ej: 2.500.000"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="crm-edit-cuotas">Cuotas mensuales</Label>
                      <Input
                        id="crm-edit-cuotas"
                        value={editForm.cuotas_mensuales}
                        onChange={(e) => setEditForm((f) => ({ ...f, cuotas_mensuales: e.target.value }))}
                        placeholder="Ej: 350.000"
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
                  <LeadTransmissionSelect
                    id="crm-edit-transmision"
                    value={editForm.transmision}
                    onChange={(transmision) => setEditForm((f) => ({ ...f, transmision }))}
                    disabled={isUpdating}
                  />
                  <LeadCrmQuickAppointmentPicker
                    id="crm-edit-cita"
                    dayKey={editForm.citaDayKey}
                    onDayChange={(dayKey) => setEditForm((f) => ({ ...f, citaDayKey: dayKey }))}
                    disabled={isUpdating || crmQuickAppointmentQuery.isLoading}
                  />
                  <LeadNotesSection
                    leadId={editingLead.id}
                    tenantId={editingLead.tenant_id ?? user?.tenant_id}
                    branchId={editingLead.branch_id ?? user?.branch_id}
                    legacyNotes={editingLead.notes}
                  />
                  <div className="grid gap-2">
                    <Label htmlFor="crm-edit-socio">Encargado del seguimiento (socio)</Label>
                    <Select
                      value={editForm.crm_seguimiento_socio ?? CRM_UNASSIGNED_VALUE}
                      onValueChange={(v) =>
                        setEditForm((f) => ({
                          ...f,
                          crm_seguimiento_socio:
                            v === CRM_UNASSIGNED_VALUE
                              ? null
                              : (v as "Mike" | "Antonio" | "Jota"),
                        }))
                      }
                    >
                      <SelectTrigger id="crm-edit-socio">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CRM_UNASSIGNED_VALUE}>Sin asignar</SelectItem>
                        {CRM_SEGUIMIENTO_SOCIOS.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Etiqueta pequeña arriba a la derecha en el pipeline: Mike (azul), Antonio (celeste), Jota (verde).
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="crm-edit-assignee">Seguimiento (vendedor)</Label>
                    <Select
                      value={editForm.assigned_to ?? CRM_UNASSIGNED_VALUE}
                      onValueChange={(v) =>
                        setEditForm((f) => ({
                          ...f,
                          assigned_to: v === CRM_UNASSIGNED_VALUE ? null : v,
                        }))
                      }
                    >
                      <SelectTrigger id="crm-edit-assignee">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CRM_UNASSIGNED_VALUE}>Sin asignar</SelectItem>
                        {crmAssigneeOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name || s.email || s.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Si no hay socio asignado, el color del borde usa el vendedor y su color en Configuración.
                    </p>
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
                  {crmQuickAppointmentQuery.data?.scheduled_at ? (
                    <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
                      <p className="text-sm font-semibold tracking-wide text-primary">
                        {formatLeadCitaDisplayLine(crmQuickAppointmentQuery.data.scheduled_at)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Sincronizado con Citas · edita la fecha con el lápiz
                      </p>
                    </div>
                  ) : null}
                  {(() => {
                    const rut = editingLead.rut?.trim();
                    const email = editingLead.email?.trim();
                    const region = editingLead.region?.trim() || getTagValue(editingLead.tags, REGION_TAG_PREFIX);
                    const pairs: Array<{ label: string; value: string }> = [];
                    if (rut) pairs.push({ label: "RUT", value: rut });
                    if (email) pairs.push({ label: "Correo", value: email });
                    if (region) pairs.push({ label: "Región", value: region });
                    return pairs.length ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {pairs.map((p) => (
                          <div key={p.label}>
                            <p className="text-sm text-muted-foreground">{p.label}</p>
                            <p className="text-base">{p.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {(() => {
                    const paymentType = editingLead.payment_type?.trim();
                    const budget = editingLead.budget?.trim();
                    const pie = editingLead.pie_disponible?.trim();
                    const cuotas = editingLead.cuotas_mensuales?.trim();
                    const pairs: Array<{ label: string; value: string }> = [];
                    if (paymentType) pairs.push({ label: "Financiamiento / Contado", value: paymentType });
                    if (budget) pairs.push({ label: "Presupuesto", value: budget });
                    if (pie) pairs.push({ label: "Pie", value: pie });
                    if (cuotas) pairs.push({ label: "Cuotas mensuales", value: cuotas });
                    const transmision = editingLead.transmision?.trim();
                    if (transmision) pairs.push({ label: "Transmisión", value: transmision });
                    return pairs.length ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {pairs.map((p) => (
                          <div key={p.label}>
                            <p className="text-sm text-muted-foreground">{p.label}</p>
                            <p className="text-base">{p.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                  {(() => {
                    const vehicleInterest = editingLead.vehicle_interest?.trim()
                      || getTagValue(editingLead.tags, VEHICULO_TAG_PREFIX);
                    return vehicleInterest ? (
                      <div>
                        <p className="text-sm text-muted-foreground">Vehículo de interés</p>
                        <p className="text-base">{vehicleInterest}</p>
                      </div>
                    ) : null;
                  })()}
                  {getConsignacionLabel(editingLead.tags) && (
                    <div>
                      <p className="text-sm text-muted-foreground">Etiqueta consignación</p>
                      <p className="text-base">{getConsignacionLabel(editingLead.tags)}</p>
                    </div>
                  )}
                  {(editingLead.uso_principal
                    || editingLead.pasajeros_filas
                    || editingLead.marca_preferida
                    || editingLead.anos_minimo
                    || editingLead.preferencia
                    || editingLead.alerta_crediticia
                    || editingLead.raw_message) && (
                    <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Datos del chatbot
                      </p>
                      {(() => {
                        const chatbotFields: Array<{ label: string; value: string }> = [];
                        if (editingLead.uso_principal) chatbotFields.push({ label: "Uso principal", value: editingLead.uso_principal });
                        if (editingLead.pasajeros_filas) chatbotFields.push({ label: "Pasajeros / Filas", value: editingLead.pasajeros_filas });
                        /* pie: ver sección financiera */
                        if (editingLead.marca_preferida) chatbotFields.push({ label: "Marca preferida", value: editingLead.marca_preferida });
                        if (editingLead.anos_minimo) chatbotFields.push({ label: "Año mínimo", value: editingLead.anos_minimo });
                        if (editingLead.preferencia) chatbotFields.push({ label: "Preferencia", value: editingLead.preferencia });
                        if (editingLead.alerta_crediticia) chatbotFields.push({ label: "Alerta crediticia", value: editingLead.alerta_crediticia });
                        return chatbotFields.length ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {chatbotFields.map((f) => (
                              <div key={f.label}>
                                <p className="text-sm text-muted-foreground">{f.label}</p>
                                <p className="text-base">{f.value}</p>
                              </div>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      {editingLead.raw_message && (
                        <div>
                          <p className="text-sm text-muted-foreground">Mensaje original</p>
                          <pre className="mt-1 whitespace-pre-wrap rounded bg-background/60 p-2 text-xs leading-relaxed">
                            {editingLead.raw_message}
                          </pre>
                        </div>
                      )}
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
                  <LeadNotesSection
                    leadId={editingLead.id}
                    tenantId={editingLead.tenant_id ?? user?.tenant_id}
                    branchId={editingLead.branch_id ?? user?.branch_id}
                    legacyNotes={editingLead.notes}
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">Encargado (socio)</p>
                    <p className="text-base flex items-center gap-2">
                      {(() => {
                        const s = editingLead.crm_seguimiento_socio;
                        if (!isCrmSeguimientoSocio(s)) {
                          return <span>Sin asignar</span>;
                        }
                        return (
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold text-white",
                              seguimientoSocioPillClass(s),
                            )}
                          >
                            {s}
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendedor asignado (seguimiento)</p>
                    <p className="text-base flex items-center gap-2">
                      {(() => {
                        const au = (editingLead as LeadWithAssignee).assigned_user;
                        const dot = resolveAssigneeBorderColor({
                          userId: editingLead.assigned_to,
                          crmColor: au?.crm_color ?? null,
                        });
                        const label =
                          au?.full_name?.trim() || au?.email?.trim() || "Sin asignar";
                        return (
                          <>
                            {dot && editingLead.assigned_to ? (
                              <span
                                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border"
                                style={{ backgroundColor: dot }}
                                aria-hidden
                              />
                            ) : null}
                            <span>{label}</span>
                          </>
                        );
                      })()}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2.5">
                    <p className="text-sm text-muted-foreground mb-1.5">Intentos de contacto</p>
                    <ContactAttemptsBar
                      leadId={editingLead.id}
                      value={editingLead.contact_attempts ?? 0}
                      showLabel={false}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      Meta: 3 contactos. Al llegar a 3 el lead baja al final de su columna.
                    </p>
                  </div>
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

