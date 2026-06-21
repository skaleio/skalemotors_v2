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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useDevice } from "@/contexts/DeviceContext";
import { CrmPipelineMoveBanner, type CrmPipelineMoveNotice } from "@/components/crm/CrmPipelineMoveBanner";
import { LeadNotesSection, type LeadNotesSectionHandle } from "@/components/crm/LeadNotesSection";
import { AssignLeadMenu } from "@/components/leads/AssignLeadMenu";
import { LeadContactStateBadge } from "@/components/leads/LeadContactStateBadge";
import { LeadContactStateSelect } from "@/components/leads/LeadContactStateSelect";
import { LeadDelegationAdminBlock } from "@/components/leads/LeadDelegationAdminBlock";
import { LeadTransmissionSelect } from "@/components/leads/LeadTransmissionSelect";
import { CrmLeadContactTrackingBlock } from "@/components/crm/CrmLeadContactTrackingBlock";
import { CrmLeadScheduleAppointmentDialog } from "@/components/crm/CrmLeadScheduleAppointmentDialog";
import { CrmTeamPerformanceBar } from "@/components/crm/CrmTeamPerformanceBar";
import { ContactAttemptsBar } from "@/components/leads/ContactAttemptsBar";
import { useBranchSellers } from "@/hooks/useBranchSellers";
import {
  fetchDelegatableSellers,
  resolveDelegatableSellersScope,
  useBranchSellersOptionsFromUser,
  type BranchSeller,
} from "@/lib/delegatableSellersScope";
import { VendorLoginGate } from "@/components/VendorLoginGate";
import { useLeads } from "@/hooks/useLeads";
import { useConfirmDialog, type ConfirmOptions } from "@/hooks/useConfirmDialog";
import { resolveAssigneeBorderColor } from "@/lib/crmAssigneeColor";
import {
  CRM_PIPELINE_STAGES,
  CRM_PIPELINE_STATUS_LABELS,
  CRM_CANCELLED_VISIBLE_MAX,
  CRM_KANBAN_COLUMN_PREVIEW_MAX,
  compareLeadsForCrmKanbanColumn,
  CRM_STAGE_BORDER_CLASS,
  CRM_STAGE_DOT_CLASS,
  CRM_STAGE_PILL_CLASS,
  type CrmStageKey,
  crmStageToDbStatus,
  getLeadCrmStageKey,
  isLeadVisibleInCrmKanban,
  leadBelongsToCrmStage,
  pickCancelledLeadIdsVisibleInCrm,
  safePipelineSelectValue,
} from "@/lib/crmPipeline";
import { isCrmSeguimientoSocio, seguimientoSocioPillClass } from "@/lib/crmSeguimientoSocio";
import {
  canAssignLeadContactState,
  canSetLeadContactState,
  contactStateClearPatch,
  contactStateToPriority,
  shouldClearContactStateOnVendorExitNuevo,
  shouldShowLeadContactStateBadge,
  type LeadContactState,
} from "@/lib/leadContactState";
import { sanitizeName } from "@/lib/format";
import { leadTransmissionForForm, leadTransmissionForSave } from "@/lib/leadTransmission";
import {
  filterLeadsForVendorView,
  leadsAssignedToForQuery,
  leadsBranchIdForQuery,
} from "@/lib/leadsScope";
import { notifyDealClosed } from "@/lib/notifications/dealClosed";
import { leadService } from "@/lib/services/leads";
import { saleService } from "@/lib/services/sales";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Loader2, Mail, Pencil, Phone, RotateCcw, Search, Target, TrendingUp, Trash2, Users, X, PhoneOff, ArrowUpRight, Skull } from "lucide-react";
import type { DragEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Link, useLocation } from "react-router-dom";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

type LeadWithAssignee = Lead & {
  assigned_user?: { id?: string; full_name?: string | null; email?: string | null; crm_color?: string | null } | null;
};

const CRM_UNASSIGNED_VALUE = "__crm_sin_asignar__";
const CRM_VIEW_GLOBAL = "__all__";

const CLOSE_DEAL_PAYMENT_METHODS = [
  { value: "transferencia", label: "Transferencia" },
  { value: "contado", label: "Contado" },
] as const;

type CloseDealPaymentMethod = (typeof CLOSE_DEAL_PAYMENT_METHODS)[number]["value"];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function inferCloseDealPaymentMethod(paymentType: string | null | undefined): CloseDealPaymentMethod {
  const pt = (paymentType || "").toLowerCase();
  if (pt.includes("transfer")) return "transferencia";
  return "contado";
}

function closeDealPaymentMethodLabel(method: CloseDealPaymentMethod): string {
  return CLOSE_DEAL_PAYMENT_METHODS.find((o) => o.value === method)?.label ?? "Contado";
}

function resolveEffectiveAssigneeId(
  lead: Pick<Lead, "assigned_to" | "created_by"> | null | undefined,
): string | null {
  if (!lead) return null;
  return lead.assigned_to ?? lead.created_by ?? null;
}

/** Vendedor de seguimiento explícito (`assigned_to`); sin fallback a `created_by`. */
function leadAssignedToId(lead: Pick<Lead, "assigned_to"> | null | undefined): string | null {
  if (!lead) return null;
  const id = lead.assigned_to?.trim();
  return id || null;
}

function assigneeDisplayName(lead: LeadWithAssignee): string | null {
  const assigneeId = leadAssignedToId(lead);
  if (!assigneeId) return null;
  const full = lead.assigned_user?.full_name?.trim();
  if (full) return full;
  const email = lead.assigned_user?.email?.trim();
  if (email) return email;
  return null;
}

/** Etiqueta corta para la esquina de la tarjeta (primer nombre). */
function assigneeCornerLabel(lead: LeadWithAssignee): string | null {
  const name = assigneeDisplayName(lead);
  if (!name) return null;
  const first = name.split(/\s+/).filter(Boolean)[0];
  return first || name;
}

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

/** Href `tel:` (E.164 chileno) para llamar desde móvil; null si no hay número válido. */
function buildTelHref(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const e164 = digits.startsWith("56") ? `+${digits}` : `+56${digits}`;
  return `tel:${e164}`;
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

/** MIME para DataTransfer (evita colisiones con texto plano). */
const DRAG_LEAD_MIME = "application/x-skale-lead-id";

const stageStyles: Record<CrmStageKey, { border: string; badge: string; dot: string }> =
  Object.fromEntries(
    CRM_PIPELINE_STAGES.map((stage) => [
      stage.key,
      {
        border: CRM_STAGE_BORDER_CLASS[stage.key],
        badge: CRM_STAGE_PILL_CLASS[stage.key],
        dot: CRM_STAGE_DOT_CLASS[stage.key],
      },
    ]),
  ) as Record<CrmStageKey, { border: string; badge: string; dot: string }>;

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

function buildCrmLeadEditForm(lead: Lead) {
  return {
    full_name: lead.full_name || "",
    phone: (lead.phone || "").replace(/^(\+56\s*)/g, ""),
    email: lead.email || "",
    region: lead.region || getTagValue(lead.tags, REGION_TAG_PREFIX) || "",
    payment_type: lead.payment_type || "",
    budget: lead.budget || "",
    pie: lead.pie_disponible || "",
    cuotas_mensuales: lead.cuotas_mensuales || "",
    vehicle: getTagValue(lead.tags, VEHICULO_TAG_PREFIX) || "",
    transmision: leadTransmissionForForm(lead.transmision),
    status: safePipelineSelectValue(lead.status),
    assigned_to: lead.assigned_to ?? null,
    contact_attempts: lead.contact_attempts ?? 0,
    contact_state: lead.contact_state ?? null,
  };
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

function describeLeadMoveError(err: unknown, targetStage?: CrmStageKey): string {
  const e = err as { message?: string; code?: string };
  const raw = (e.message ?? "").toLowerCase();
  if (e.code === "23514" && raw.includes("leads_status_check")) {
    if (targetStage === "cancelado") {
      return "No se pudo marcar como cancelado. Recarga la página e intenta de nuevo; si persiste, avisa al equipo técnico.";
    }
    return "Ese estado no está permitido en el pipeline. Recarga la página e intenta de nuevo.";
  }
  return describeSupabaseError(err);
}

function cancelLeadConfirmOptions(leadName: string): ConfirmOptions {
  return {
    title: "¿Marcar como cancelado?",
    description: `«${leadName}» saldrá del pipeline activo. En esta vista solo verás los últimos ${CRM_CANCELLED_VISIBLE_MAX} cancelados; los anteriores siguen en Leads.`,
    confirmLabel: "Sí, cancelar",
    destructive: true,
  };
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
  showAssigneeBadge = false,
  showContactStateBadge = true,
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
  /** Solo admin / supervisión: etiqueta con vendedor asignado en la esquina. */
  showAssigneeBadge?: boolean;
  /** Etiqueta de calificación (vendedor: solo en columna Nuevo). */
  showContactStateBadge?: boolean;
}) {
  const label = getConsignacionLabel(lead.tags);
  const styles = label ? (labelStyles[label] || labelStyles.sin_etiqueta) : null;
  const hasAiState = lead.state != null && lead.state !== "";
  const lastDragEndRef = useRef(0);
  const attempts = Math.max(0, Math.min(lead.contact_attempts ?? 0, 3));
  const socio = isCrmSeguimientoSocio(lead.crm_seguimiento_socio) ? lead.crm_seguimiento_socio : null;
  const assigneeId = leadAssignedToId(lead);
  const assigneeName = assigneeCornerLabel(lead);
  const assigneeFullName = assigneeDisplayName(lead);
  const cornerAssigneeLabel = showAssigneeBadge && assigneeName ? assigneeName : null;
  const hasContactState =
    showContactStateBadge && lead.contact_state != null && lead.contact_state !== "";
  const assigneeBorder = socio
    ? null
    : resolveAssigneeBorderColor({
        userId: assigneeId,
        crmColor: lead.assigned_user?.crm_color ?? null,
      });
  /** Semáforo de intentos: visible en columnas activas del pipeline (no en vendido). */
  const showContactAttemptsSemaforo = useMemo(() => {
    const stage = getLeadCrmStageKey(lead.status);
    return (
      stage === "nuevo"
      || stage === "no_contesta"
      || stage === "en_seguimiento"
      || stage === "buscando_vehiculo"
      || stage === "agendado"
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
      onClick={handleCardOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleCardOpen()}
      aria-grabbed={isDragging ? true : undefined}
      title={draggable ? "Arrastra a otra columna o haz clic para abrir" : undefined}
      className={cn(
        "relative rounded-lg border bg-card px-3 py-2 text-sm shadow-sm",
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
      {cornerAssigneeLabel ? (
        <span
          title={assigneeFullName ? `Asignado a ${assigneeFullName}` : undefined}
          className={cn(
            "pointer-events-none absolute right-1 top-1 z-[1] max-w-[5.75rem] truncate rounded-md border px-1.5 py-0.5 text-[9px] font-medium leading-tight shadow-sm",
            assigneeBorder
              ? "border-current/25 bg-background/90"
              : "border-border/60 bg-muted/90 text-muted-foreground",
          )}
          style={
            assigneeBorder
              ? { color: assigneeBorder, borderColor: `${assigneeBorder}55` }
              : undefined
          }
        >
          {cornerAssigneeLabel}
        </span>
      ) : socio ? (
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
      {showContactStateBadge ? (
        <LeadContactStateBadge value={lead.contact_state} variant="corner" />
      ) : null}
      <div
        className={cn(
          "font-medium truncate",
          hasContactState && "pl-[4.75rem]",
          (cornerAssigneeLabel || socio) && "pr-[4.75rem]",
        )}
      >
        {lead.full_name || "Sin nombre"}
      </div>
      <div className="text-muted-foreground text-[13px]">
        {formatChilePhoneForDisplay(lead.phone) || "Sin telefono"}
      </div>
      <LeadDelegationAdminBlock lead={lead} variant="inline" className="mt-1" />
      <div className="mt-1.5">
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

const CAN_SUPERVISE = new Set(["admin", "gerente", "jefe_jefe", "jefe_sucursal", "financiero"]);
/** Vista global del CRM (todos los leads del tenant visibles para el rol). */
const CAN_USE_CRM_GLOBAL_VIEW = new Set(["admin", "jefe_jefe"]);

export default function CRM() {
  const { user } = useAuth();
  const { isMobileDevice } = useDevice();
  const location = useLocation();
  const vendorMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("vendor") === "1";
  }, [location.search]);

  const queryClient = useQueryClient();
  const { confirm: askConfirm, ConfirmDialogHost } = useConfirmDialog();
  const { leads, loading, isFetching, error: leadsError, refetch } = useLeads({
    branchId: leadsBranchIdForQuery(user?.role, user?.branch_id),
    assignedTo: leadsAssignedToForQuery(user?.role, user?.id),
    enabled: !!user,
    live: true,
  });

  const { data: deletedLeads = [], isLoading: loadingPapelera, refetch: refetchPapelera } = useQuery({
    queryKey: ["leads", "deleted"],
    queryFn: () => leadService.getDeleted(),
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  });

  const handleRefreshCrm = useCallback(async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["seller-engagement"] }),
      queryClient.invalidateQueries({ queryKey: ["leads", "deleted"] }),
    ]);
  }, [refetch, queryClient]);

  const [showPapeleraDialog, setShowPapeleraDialog] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isEmptyingPapelera, setIsEmptyingPapelera] = useState(false);

  const canSupervise = !!user?.role && CAN_SUPERVISE.has(user.role);
  const canSetContactState = canSetLeadContactState(user?.role);
  const canUseGlobalView = !!user?.role && CAN_USE_CRM_GLOBAL_VIEW.has(user.role);
  const [supervisedVendorId, setSupervisedVendorId] = useState<string | null>(null);

  const crmSupervisorSelectValue =
    supervisedVendorId ?? (canUseGlobalView ? CRM_VIEW_GLOBAL : undefined);

  const vendorListQuery = useBranchSellersOptionsFromUser(user, {
    roles: ["vendedor"],
    enabled: canSupervise,
  });
  const { sellers: vendorList } = useBranchSellers(vendorListQuery);

  const scopedLeads = useMemo(() => {
    if (user?.role === "vendedor" && user.id) {
      return filterLeadsForVendorView(leads, user.id);
    }
    return leads;
  }, [leads, user?.role, user?.id]);

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
  const [expandedKanbanStages, setExpandedKanbanStages] = useState<Set<CrmStageKey>>(() => new Set());
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [leadStatus, setLeadStatus] = useState<string>("en_seguimiento");
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
    status: "en_seguimiento",
    /** Vendedor que hace el seguimiento (`leads.assigned_to`) */
    assigned_to: null as string | null,
    contact_attempts: 0,
    contact_state: null as LeadContactState | null,
  });

  const crmAssigneeQuery = useBranchSellersOptionsFromUser(user, {
    roles: ["vendedor", "jefe_sucursal"],
    enabled: !!user?.tenant_id && showEditDialog && isEditingForm,
  });
  const { sellers: crmAssigneeOptions } = useBranchSellers(crmAssigneeQuery);

  const crmAssigneeSelectOptions = useMemo((): BranchSeller[] => {
    if (!editingLead || !isEditingForm) return crmAssigneeOptions;
    const currentId = editForm.assigned_to ?? editingLead.assigned_to ?? null;
    if (!currentId || crmAssigneeOptions.some((s) => s.id === currentId)) {
      return crmAssigneeOptions;
    }
    const au = (editingLead as LeadWithAssignee).assigned_user;
    return [
      {
        id: currentId,
        full_name: au?.full_name?.trim() || au?.email?.trim() || currentId,
        email: au?.email ?? null,
        branch_id: editingLead.branch_id ?? null,
        role: "vendedor",
        crm_color: au?.crm_color ?? null,
      },
      ...crmAssigneeOptions,
    ];
  }, [crmAssigneeOptions, editingLead, editForm.assigned_to, isEditingForm]);

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

  const openEditDialog = useCallback((lead: LeadWithAssignee, opts?: { editMode?: boolean }) => {
    const fresh = (leads.find((l) => l.id === lead.id) ?? lead) as LeadWithAssignee;
    setEditingLead(fresh);
    const status = safePipelineSelectValue(fresh.status);
    setLeadStatus(status);
    if (opts?.editMode) {
      setEditForm(buildCrmLeadEditForm(fresh));
      setIsEditingForm(true);
    } else {
      setIsEditingForm(false);
    }
    setShowEditDialog(true);
  }, [leads]);

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
      description:
        "El lead se moverá a la papelera. Podrás verlo y restaurarlo desde el icono de papelera en el pipeline.",
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
      queryClient.invalidateQueries({ queryKey: ["leads", "deleted"] });
      closeEditDialog();
      toast({
        title: "Lead eliminado",
        description: "El lead se movió a la papelera.",
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
  }, [editingLead, queryClient, closeEditDialog, askConfirm]);

  const papeleraLeads = useMemo(() => {
    return deletedLeads.filter((lead) => {
      const tags = normalizeTags(lead.tags);
      if (tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX))) return false;
      if (supervisedVendorId && lead.assigned_to !== supervisedVendorId) return false;
      return true;
    });
  }, [deletedLeads, supervisedVendorId]);

  const handleRestoreLead = useCallback(
    async (id: string) => {
      setRestoringId(id);
      try {
        await leadService.restore(id);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["leads", "deleted"] });
        await refetch();
        await refetchPapelera();
        toast({
          title: "Lead restaurado",
          description: "El lead volvió al pipeline del CRM.",
        });
      } catch (error: unknown) {
        console.error("Error restaurando lead:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "No se pudo restaurar el lead.",
          variant: "destructive",
        });
      } finally {
        setRestoringId(null);
      }
    },
    [queryClient, refetch, refetchPapelera],
  );

  const handleEmptyPapelera = useCallback(async () => {
    if (papeleraLeads.length === 0) return;
    const count = papeleraLeads.length;
    const ok = await askConfirm({
      title: "¿Vaciar la papelera?",
      description: `Se eliminarán permanentemente ${count} lead${count === 1 ? "" : "s"}. Esta acción no se puede deshacer.`,
      confirmLabel: "Vaciar papelera",
      destructive: true,
    });
    if (!ok) return;

    setIsEmptyingPapelera(true);
    try {
      const { requested, deleted } = await leadService.hardDeleteFromTrash(
        papeleraLeads.map((lead) => lead.id),
      );
      queryClient.invalidateQueries({ queryKey: ["leads", "deleted"] });
      await refetchPapelera();
      if (deleted === 0) {
        toast({
          title: "No se pudo vaciar",
          description: "No tienes permiso para eliminar estos leads o ya no están en la papelera.",
          variant: "destructive",
        });
        return;
      }
      if (deleted < requested) {
        toast({
          title: "Papelera vaciada parcialmente",
          description: `Se eliminaron ${deleted} de ${requested} leads. Algunos no se pudieron borrar por permisos.`,
        });
        return;
      }
      toast({
        title: "Papelera vaciada",
        description: `Se eliminaron ${deleted} lead${deleted === 1 ? "" : "s"} de forma permanente.`,
      });
    } catch (error) {
      console.error("Error vaciando papelera:", error);
      toast({
        title: "Error al vaciar",
        description: error instanceof Error ? error.message : "No se pudo vaciar la papelera.",
        variant: "destructive",
      });
    } finally {
      setIsEmptyingPapelera(false);
    }
  }, [papeleraLeads, askConfirm, queryClient, refetchPapelera]);

  const startEditing = useCallback(() => {
    if (!editingLead) return;
    setEditForm(buildCrmLeadEditForm(editingLead));
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
    const enPipeline = total - cerrados - perdidos - base.filter((l) => (l.status || "").toLowerCase() === "cancelado").length;
    const efectividad = total > 0 ? Math.round((cerrados / total) * 1000) / 10 : 0;
    const noRespondieron = deletedLeads.filter((lead) => {
      const tags = normalizeTags(lead.tags);
      if (tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX))) return false;
      if (supervisedVendorId && lead.assigned_to !== supervisedVendorId) return false;
      const st = (lead.status || "").toLowerCase();
      return st === "nuevo" || st === "no_contesta" || st === "contactado" || st === "interesado";
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
    const onlyLeads = scopedLeads.filter((lead) => {
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

    const visibleCancelledIds = pickCancelledLeadIdsVisibleInCrm(supervised);
    const kanbanLeads = supervised.filter((lead) =>
      isLeadVisibleInCrmKanban(lead, visibleCancelledIds),
    );

    // 4) Aplicar búsqueda por nombre / teléfono / correo sobre ese subconjunto.
    const q = searchQuery.trim().toLowerCase();
    if (!q) return kanbanLeads;
    return kanbanLeads.filter((lead) => {
      const name = (lead.full_name || "").toLowerCase();
      const phone = (lead.phone || "").replace(/\D/g, "");
      const phoneQuery = q.replace(/\D/g, "");
      const email = (lead.email || "").toLowerCase();
      return name.includes(q) || email.includes(q) || (phoneQuery.length >= 3 && phone.includes(phoneQuery));
    });
  }, [scopedLeads, searchQuery, supervisedVendorId]);

  const leadsByStage = useMemo(() => {
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
        .sort((a, b) => compareLeadsForCrmKanbanColumn(a, b, stage.key)),
    }));
  }, [filteredLeads, stages, crmCalendarMonthKey]);

  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStageKey, setDragOverStageKey] = useState<CrmStageKey | null>(null);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [landedLeadId, setLandedLeadId] = useState<string | null>(null);
  const landHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leadNotesRef = useRef<LeadNotesSectionHandle>(null);
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

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);

  const [showCloseDealDialog, setShowCloseDealDialog] = useState(false);
  const [closeDealLead, setCloseDealLead] = useState<Lead | null>(null);
  const [closeDealVehicle, setCloseDealVehicle] = useState("");
  const [closeDealPaymentMethod, setCloseDealPaymentMethod] = useState<CloseDealPaymentMethod>("contado");
  const [closeDealSaleDate, setCloseDealSaleDate] = useState(todayIsoDate);
  const [closeDealSellerKey, setCloseDealSellerKey] = useState("");
  const [closeDealPrice, setCloseDealPrice] = useState("");
  const [closeDealSellerOptions, setCloseDealSellerOptions] = useState<CloseDealSellerOption[]>([]);
  const [loadingBranchSellers, setLoadingBranchSellers] = useState(false);
  const [isSubmittingCloseDeal, setIsSubmittingCloseDeal] = useState(false);

  const closeCloseDealDialog = useCallback(() => {
    setShowCloseDealDialog(false);
    setCloseDealLead(null);
    setCloseDealVehicle("");
    setCloseDealPaymentMethod("contado");
    setCloseDealSaleDate(todayIsoDate());
    setCloseDealSellerKey("");
    setCloseDealPrice("");
    setCloseDealSellerOptions([]);
  }, []);

  const closeScheduleDialog = useCallback(() => {
    setShowScheduleDialog(false);
    setScheduleLead(null);
  }, []);

  const openScheduleForLead = useCallback((lead: Lead) => {
    setScheduleLead(lead);
    setShowScheduleDialog(true);
  }, []);

  const openCloseDealForLead = useCallback(
    (lead: Lead) => {
      setCloseDealLead(lead);
      setCloseDealVehicle(getTagValue(lead.tags, VEHICULO_TAG_PREFIX) || "");
      setCloseDealPaymentMethod(inferCloseDealPaymentMethod(lead.payment_type));
      setCloseDealSaleDate(todayIsoDate());
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

    if (targetStageKey === "agendado" && currentStageKey !== "agendado") {
      void openScheduleForLead(editingLead);
      return;
    }

    if (targetStageKey === "cancelado" && currentStageKey !== "cancelado") {
      const ok = await askConfirm(
        cancelLeadConfirmOptions(editingLead.full_name?.trim() || "Sin nombre"),
      );
      if (!ok) return;
    }

    setIsUpdating(true);
    try {
      if (leadNotesRef.current?.hasPendingDraft()) {
        const noteOk = await leadNotesRef.current.savePendingDraft();
        if (!noteOk) {
          setIsUpdating(false);
          return;
        }
      }

      const nextDbStatus = crmStageToDbStatus(
        (isEditingForm ? editForm.status : leadStatus) as CrmStageKey,
      );

      const updates: Record<string, unknown> = isEditingForm
        ? {
            full_name: sanitizeName(editForm.full_name) || "Sin nombre",
            phone: normalizePhoneChile(editForm.phone) || "sin_telefono",
            email: editForm.email.trim() || null,
            status: nextDbStatus,
            region: editForm.region.trim() || null,
            payment_type: editForm.payment_type.trim() || null,
            budget: editForm.budget.trim() || null,
            pie_disponible: editForm.pie.trim() || null,
            cuotas_mensuales: editForm.cuotas_mensuales.trim() || null,
            transmision: leadTransmissionForSave(editForm.transmision),
            tags: buildTagsWithVehicle(editingLead.tags, editForm.vehicle),
            assigned_to: editForm.assigned_to,
            contact_attempts: editForm.contact_attempts,
          }
        : { status: nextDbStatus };

      if (
        shouldClearContactStateOnVendorExitNuevo(user?.role, editingLead.status, nextDbStatus)
      ) {
        Object.assign(updates, contactStateClearPatch());
      } else if (
        isEditingForm
        && canAssignLeadContactState(user?.role, editForm.status)
      ) {
        updates.contact_state = editForm.contact_state;
        if (editForm.contact_state != null) {
          updates.priority = contactStateToPriority(editForm.contact_state);
        }
      }

      if (
        isEditingForm
        && editForm.contact_attempts > (editingLead.contact_attempts ?? 0)
      ) {
        updates.last_contact_at = new Date().toISOString();
      }

      const updated = await leadService.update(editingLead.id, updates as any);

      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead));
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["seller-engagement"] });
      if (isEditingForm) {
        setEditingLead(updated as Lead);
        setIsEditingForm(false);
      } else {
        closeEditDialog();
      }
    } catch (error: unknown) {
      console.error("[CRM] handleUpdateLead", { leadId: editingLead.id, isEditingForm, error });
      toast({
        title: "No se pudo actualizar el lead",
        description: describeLeadMoveError(
          error,
          (isEditingForm ? editForm.status : leadStatus) as CrmStageKey,
        ),
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
    user?.role,
    askConfirm,
    openCloseDealForLead,
    openScheduleForLead,
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

      if (!isVendedor) {
        const delegateScope = resolveDelegatableSellersScope(user, ["vendedor"]);
        if (delegateScope) {
          try {
            const rows = await fetchDelegatableSellers(delegateScope);
            if (cancelled) return;
            for (const r of rows) {
              if (user.id && r.id === user.id) continue;
              merged.push({
                key: closeDealSellerKeyUser(r.id),
                label: r.full_name || r.email || r.id,
              });
            }
          } catch (err) {
            console.error("CRM: vendedores delegables", err);
          }
        }
        if (
          assignedId &&
          assignedId !== user.id &&
          !merged.some((r) => r.key === closeDealSellerKeyUser(assignedId))
        ) {
          merged.push({ key: closeDealSellerKeyUser(assignedId), label: "Vendedor asignado al lead" });
        }
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

      if (stageKey === "agendado") {
        void openScheduleForLead(lead);
        setDraggingLeadId(null);
        return;
      }

      if (stageKey === "cancelado") {
        setDraggingLeadId(null);
        const ok = await askConfirm(cancelLeadConfirmOptions(lead.full_name?.trim() || "Sin nombre"));
        if (!ok) return;
      }

      const nextStatus = crmStageToDbStatus(stageKey) as Lead["status"];
      const previousStatus = lead.status;
      setMovingLeadId(leadId);
      const clearContactState = shouldClearContactStateOnVendorExitNuevo(
        user?.role,
        previousStatus,
        nextStatus,
      );
      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((l: Lead) => {
          if (l.id !== leadId) return l;
          return {
            ...l,
            status: nextStatus,
            ...(clearContactState ? contactStateClearPatch() : {}),
          };
        });
      });

      try {
        const dropUpdates: Record<string, unknown> = { status: nextStatus };
        if (clearContactState) Object.assign(dropUpdates, contactStateClearPatch());
        const updated = await leadService.update(leadId, dropUpdates as any);
        queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
          if (!Array.isArray(current)) return current;
          return current.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));
        });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["seller-engagement"] });
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
          description: describeLeadMoveError(err, stageKey),
          variant: "destructive",
        });
      } finally {
        setMovingLeadId(null);
        setDraggingLeadId(null);
      }
    },
    [leads, filteredLeads, queryClient, openCloseDealForLead, openScheduleForLead, showPipelineMoveNotice, askConfirm, user?.role],
  );

  const handleLeadScheduled = useCallback(
    async (updated: Lead, previousStatus: string | null) => {
      const leadId = updated.id;
      const sourceLead = scheduleLead;
      setMovingLeadId(leadId);

      if (editingLead?.id === leadId) {
        setEditingLead((prev) => (prev ? { ...prev, ...updated } : prev));
        setEditForm((f) => ({ ...f, status: "agendado" }));
        setLeadStatus("agendado");
      }

      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));
      });
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.invalidateQueries({ queryKey: ["crmLeadQuickAppointment", leadId] });
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
      await queryClient.invalidateQueries({ queryKey: ["seller-engagement"] });

      if (sourceLead) {
        showPipelineMoveNotice(sourceLead, previousStatus, "agendado");
      }
      if (landHighlightTimerRef.current) clearTimeout(landHighlightTimerRef.current);
      setLandedLeadId(leadId);
      landHighlightTimerRef.current = setTimeout(() => {
        setLandedLeadId(null);
        landHighlightTimerRef.current = null;
      }, 700);

      closeScheduleDialog();
      setMovingLeadId(null);
    },
    [scheduleLead, editingLead?.id, queryClient, closeScheduleDialog, showPipelineMoveNotice],
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

    const paymentLabel = closeDealPaymentMethodLabel(closeDealPaymentMethod);
    const saleDate = closeDealSaleDate.trim() || todayIsoDate();
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
              closed_at: `${saleDate}T12:00:00.000Z`,
            }
          : l,
      );
    });

    const previousStatus = closeDealLead.status ?? null;
    const previousPaymentType = closeDealLead.payment_type ?? null;
    const previousAssignedTo = closeDealLead.assigned_to ?? null;
    const previousClosedByStaff = closeDealLead.closed_by_staff_id ?? null;
    const previousTags = closeDealLead.tags;
    const previousClosedAt = closeDealLead.closed_at ?? null;
    try {
      const updated = await leadService.update(leadId, {
        status: "vendido",
        payment_type: paymentLabel,
        assigned_to: assignedToAfter,
        closed_by_staff_id: closedByStaffAfter,
        tags: nextTags,
        closed_at: `${saleDate}T12:00:00.000Z`,
      });
      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((l) => (l.id === updated.id ? { ...l, ...updated } : l));
      });
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
          tenant_id: updated.tenant_id ?? user?.tenant_id ?? null,
          sale_price: salePrice,
          payment_method: closeDealPaymentMethod,
          payment_status: "realizado",
          status: "completada",
          sale_date: saleDate,
          notes: `Cierre desde CRM · Lead ${closeDealLead.full_name ?? leadId}`,
        });
        queryClient.invalidateQueries({ queryKey: ["sales-ranking"] });
        queryClient.invalidateQueries({ queryKey: ["sales"] });
        queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats-v2"] });
        queryClient.invalidateQueries({ queryKey: ["fund-management"] });
      } catch (saleErr) {
        console.error("No se pudo registrar la venta", saleErr);
        await leadService.update(leadId, {
          status: previousStatus ?? "negociando",
          payment_type: previousPaymentType,
          assigned_to: previousAssignedTo,
          closed_by_staff_id: previousClosedByStaff,
          tags: previousTags as Lead["tags"],
          closed_at: previousClosedAt,
        });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast({
          title: "No se pudo registrar la venta",
          description:
            "El lead no se movió a negocio cerrado. Revisa permisos o intenta desde Ventas.",
          variant: "destructive",
        });
        return;
      }
      notifyDealClosed({
        lead: updated,
        previousStatus,
        vehicleLabel: vehicle,
        actorUserId: user?.id ?? null,
        salePrice,
        sellerName: sellerLabel && sellerLabel !== "Vendedor asignado al lead" ? sellerLabel : null,
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
        description: `Venta registrada (${paymentLabel}) por ${salePrice.toLocaleString("es-CL")} CLP. Visible en Ventas y ranking.`,
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
    closeDealPaymentMethod,
    closeDealSaleDate,
    closeDealSellerKey,
    closeDealSellerOptions,
    closeDealVehicle,
    queryClient,
    user?.role,
    user?.id,
    user?.branch_id,
    user?.tenant_id,
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
      <ConfirmDialogHost />
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between [@media(max-height:600px)]:gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight [@media(max-height:600px)]:text-xl">CRM</h1>
          <p className="text-muted-foreground mt-2 [@media(max-height:600px)]:hidden">
            Gestión de clientes y relaciones
          </p>
          <p className="text-xs text-muted-foreground mt-1 hidden sm:block [@media(max-height:600px)]:!hidden">
            Arrastra una tarjeta a otra columna para cambiar el estado. Al mover a{" "}
            <span className="font-medium">NEGOCIO CONCRETADO</span> se pedirán datos de la venta antes de guardar.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center shrink-0">
          {canSupervise && (
            <Select
              value={crmSupervisorSelectValue ?? ""}
              onValueChange={(val) => {
                if (val === CRM_VIEW_GLOBAL) {
                  setSupervisedVendorId(null);
                  return;
                }
                setSupervisedVendorId(val);
              }}
            >
              <SelectTrigger className="w-full sm:w-52 gap-2">
                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Ver CRM de vendedor…" />
              </SelectTrigger>
              <SelectContent>
                {canUseGlobalView ? (
                  <>
                    <SelectItem value={CRM_VIEW_GLOBAL}>Vista global</SelectItem>
                    {vendorList.length > 0 ? <SelectSeparator /> : null}
                  </>
                ) : null}
                {vendorList.length > 0 ? (
                  <>
                    <SelectGroup>
                      <SelectLabel>Vendedores</SelectLabel>
                      {vendorList.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.full_name || v.email || v.id}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : null}
              </SelectContent>
            </Select>
          )}
          {canSupervise && (
            <CrmTeamPerformanceBar
              leads={leads}
              vendors={vendorList}
              enabled={canSupervise}
              onSelectVendor={(vendorId) => setSupervisedVendorId(vendorId)}
            />
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => void handleRefreshCrm()}
            disabled={loading || isFetching}
            title="Actualizar leads del CRM"
            aria-label="Actualizar lista de leads del CRM"
            className="shrink-0"
          >
            <RotateCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPapeleraDialog(true)}
            title="Ver papelera — leads eliminados del pipeline"
            aria-label="Ver papelera de leads eliminados"
            className="relative shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            {papeleraLeads.length > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {papeleraLeads.length > 99 ? "99+" : papeleraLeads.length}
              </span>
            ) : null}
          </Button>
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
        <Card
          className={cn(
            "transition-colors",
            papeleraLeads.length > 0 && "cursor-pointer hover:bg-muted/40",
          )}
          onClick={papeleraLeads.length > 0 ? () => setShowPapeleraDialog(true) : undefined}
          role={papeleraLeads.length > 0 ? "button" : undefined}
          tabIndex={papeleraLeads.length > 0 ? 0 : undefined}
          onKeyDown={
            papeleraLeads.length > 0
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowPapeleraDialog(true);
                  }
                }
              : undefined
          }
          title={papeleraLeads.length > 0 ? "Ver leads en la papelera" : undefined}
        >
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
                {papeleraLeads.length > 0 ? " · clic para ver" : ""}
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

      <CrmPipelineMoveBanner notice={pipelineMoveNotice} onDismiss={dismissPipelineMoveNotice} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Pipeline de ventas</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPapeleraDialog(true)}
          className="gap-2"
          title="Ver leads eliminados del pipeline"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          Papelera
          {papeleraLeads.length > 0 ? (
            <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5">
              {papeleraLeads.length}
            </Badge>
          ) : null}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {leadsByStage.map((stage) => {
          const style = stageStyles[stage.key];
          const isColumnExpanded = expandedKanbanStages.has(stage.key);
          const hasMoreThanPreview = stage.leads.length > CRM_KANBAN_COLUMN_PREVIEW_MAX;
          const visibleLeads = isColumnExpanded || !hasMoreThanPreview
            ? stage.leads
            : stage.leads.slice(0, CRM_KANBAN_COLUMN_PREVIEW_MAX);
          const hiddenLeadCount = stage.leads.length - CRM_KANBAN_COLUMN_PREVIEW_MAX;

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
                {stage.key === "nuevo" ? (
                  <CardDescription className="text-[11px] pt-1 text-cyan-700/80 dark:text-cyan-300/80">
                    Leads recién ingresados, sin contacto aún.
                  </CardDescription>
                ) : null}
                {stage.key === "negocio_cerrado" ? (
                  <CardDescription className="text-[11px] pt-1">
                    Solo negocios cerrados en el mes en curso (calendario local). Al cambiar de mes, la columna arranca vacía; el resto del embudo no se mueve.
                  </CardDescription>
                ) : null}
                {stage.key === "cancelado" ? (
                  <CardDescription className="text-[11px] pt-1 text-rose-700/80 dark:text-rose-300/80">
                    Últimos {CRM_CANCELLED_VISIBLE_MAX} cancelados. Los anteriores siguen en Leads pero no se muestran aquí.
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
                    <>
                      {visibleLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          showAssigneeBadge={canSupervise}
                          showContactStateBadge={shouldShowLeadContactStateBadge(lead, user?.role)}
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
                      ))}
                      {hasMoreThanPreview && !isColumnExpanded ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setExpandedKanbanStages((prev) => new Set(prev).add(stage.key))
                          }
                        >
                          Ver más ({hiddenLeadCount})
                        </Button>
                      ) : null}
                      {hasMoreThanPreview && isColumnExpanded ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setExpandedKanbanStages((prev) => {
                              const next = new Set(prev);
                              next.delete(stage.key);
                              return next;
                            })
                          }
                        >
                          Ver menos
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CrmLeadScheduleAppointmentDialog
        open={showScheduleDialog}
        onOpenChange={(open) => {
          if (!open) closeScheduleDialog();
          else setShowScheduleDialog(true);
        }}
        lead={scheduleLead}
        onScheduled={(updated, previousStatus) => void handleLeadScheduled(updated, previousStatus)}
      />

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
                  Se crea una venta en el módulo Ventas (precio, vehículo, vendedor y fecha).
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="close-deal-sale-date">Fecha de venta</Label>
                <Input
                  id="close-deal-sale-date"
                  type="date"
                  value={closeDealSaleDate}
                  onChange={(e) => setCloseDealSaleDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="close-deal-payment-method">Método de pago</Label>
                <Select
                  value={closeDealPaymentMethod}
                  onValueChange={(v) => setCloseDealPaymentMethod(v as CloseDealPaymentMethod)}
                >
                  <SelectTrigger id="close-deal-payment-method">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLOSE_DEAL_PAYMENT_METHODS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
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
                !closeDealSaleDate.trim() ||
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
                  onDelegated={(updated) => {
                    const row = updated as LeadWithAssignee;
                    setEditingLead((prev) =>
                      prev?.id === updated.id
                        ? { ...prev, ...updated, assigned_user: row.assigned_user ?? prev.assigned_user }
                        : prev,
                    );
                    void queryClient.invalidateQueries({ queryKey: ["leads"] });
                  }}
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
                  <CrmLeadContactTrackingBlock
                    leadId={editingLead.id}
                    value={editForm.contact_attempts}
                    localOnly
                    onChange={(next) => setEditForm((f) => ({ ...f, contact_attempts: next }))}
                  />
                  {canSetContactState ? (
                    <LeadContactStateSelect
                      value={editForm.contact_state}
                      localOnly
                      disabled={isUpdating}
                      onChange={(next) => setEditForm((f) => ({ ...f, contact_state: next }))}
                    />
                  ) : shouldShowLeadContactStateBadge(
                    {
                      status: crmStageToDbStatus(editForm.status as CrmStageKey),
                      contact_state: editForm.contact_state,
                    },
                    user?.role,
                  ) ? (
                    <div className="grid gap-1.5">
                      <p className="text-sm text-muted-foreground">Prioridad asignada por el equipo</p>
                      <LeadContactStateBadge value={editForm.contact_state} />
                      <p className="text-[11px] text-muted-foreground">
                        Al mover el lead a otra etapa podrás calificarlo según tu llamada.
                      </p>
                    </div>
                  ) : canAssignLeadContactState(user?.role, editForm.status) ? (
                    <LeadContactStateSelect
                      value={editForm.contact_state}
                      localOnly
                      disabled={isUpdating}
                      onChange={(next) => setEditForm((f) => ({ ...f, contact_state: next }))}
                    />
                  ) : null}
                  <LeadNotesSection
                    ref={leadNotesRef}
                    leadId={editingLead.id}
                    tenantId={editingLead.tenant_id ?? user?.tenant_id}
                    branchId={editingLead.branch_id ?? user?.branch_id}
                    legacyNotes={editingLead.notes}
                    askConfirm={askConfirm}
                  />
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
                        {crmAssigneeSelectOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name || s.email || s.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <LeadDelegationAdminBlock lead={editingLead as LeadWithAssignee} />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Nombre</p>
                      <p className="text-base font-medium">{editingLead.full_name || "Sin nombre"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Teléfono</p>
                      {(() => {
                        const display = formatChilePhoneForDisplay(editingLead.phone) || "—";
                        const telHref = isMobileDevice ? buildTelHref(editingLead.phone) : null;
                        return telHref ? (
                          <a
                            href={telHref}
                            className="text-base text-primary underline underline-offset-2 inline-flex items-center gap-1.5"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {display}
                          </a>
                        ) : (
                          <p className="text-base">{display}</p>
                        );
                      })()}
                    </div>
                  </div>
                  {canSetContactState ? (
                    <LeadContactStateSelect
                      leadId={editingLead.id}
                      value={editingLead.contact_state}
                      onChange={(next) =>
                        setEditingLead((prev) =>
                          prev
                            ? {
                                ...prev,
                                contact_state: next,
                                ...(next ? { priority: contactStateToPriority(next) } : {}),
                              }
                            : prev,
                        )
                      }
                    />
                  ) : shouldShowLeadContactStateBadge(editingLead, user?.role) ? (
                    <div className="grid gap-1.5">
                      <p className="text-sm text-muted-foreground">Prioridad asignada por el equipo</p>
                      <LeadContactStateBadge value={editingLead.contact_state} />
                      <p className="text-[11px] text-muted-foreground">
                        Visible solo en Nuevo. Muévelo de etapa para calificarlo tú según la llamada.
                      </p>
                    </div>
                  ) : canAssignLeadContactState(user?.role, editingLead.status) ? (
                    <LeadContactStateSelect
                      leadId={editingLead.id}
                      value={editingLead.contact_state}
                      onChange={(next) =>
                        setEditingLead((prev) =>
                          prev
                            ? {
                                ...prev,
                                contact_state: next,
                                ...(next ? { priority: contactStateToPriority(next) } : {}),
                              }
                            : prev,
                        )
                      }
                    />
                  ) : null}
                  <CrmLeadContactTrackingBlock
                    leadId={editingLead.id}
                    value={editingLead.contact_attempts ?? 0}
                    onChange={(next) =>
                      setEditingLead((prev) => (prev ? { ...prev, contact_attempts: next } : prev))
                    }
                  />
                  <LeadNotesSection
                    ref={leadNotesRef}
                    leadId={editingLead.id}
                    tenantId={editingLead.tenant_id ?? user?.tenant_id}
                    branchId={editingLead.branch_id ?? user?.branch_id}
                    legacyNotes={editingLead.notes}
                    askConfirm={askConfirm}
                  />
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
                    <div>
                    <p className="text-sm text-muted-foreground">Vendedor asignado (seguimiento)</p>
                    <p className="text-base flex items-center gap-2">
                      {(() => {
                        const assigneeId = leadAssignedToId(editingLead);
                        if (!assigneeId) {
                          return <span className="text-muted-foreground">Sin asignar</span>;
                        }
                        const au = (editingLead as LeadWithAssignee).assigned_user;
                        const dot = resolveAssigneeBorderColor({
                          userId: assigneeId,
                          crmColor: au?.crm_color ?? null,
                        });
                        const label = au?.full_name?.trim() || au?.email?.trim() || assigneeId;
                        return (
                          <>
                            {dot ? (
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

      <Dialog open={showPapeleraDialog} onOpenChange={setShowPapeleraDialog}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              Papelera
            </DialogTitle>
            <DialogDescription>
              Leads eliminados del pipeline. Puedes restaurarlos para que vuelvan al embudo del CRM.
              {supervisedVendorId && supervisedVendorName
                ? ` Mostrando solo los de ${supervisedVendorName}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 py-2 -mx-1 px-1">
            {loadingPapelera ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Cargando...
              </div>
            ) : papeleraLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay leads en la papelera.</p>
            ) : (
              <ul className="space-y-2">
                {papeleraLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{lead.full_name || "Sin nombre"}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {formatChilePhoneForDisplay(lead.phone) || "—"}
                        {lead.email ? (
                          <>
                            <span className="mx-1">·</span>
                            <Mail className="h-3.5 w-3.5 shrink-0 inline" />
                            <span className="truncate">{lead.email}</span>
                          </>
                        ) : null}
                      </p>
                      {lead.deleted_at ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Eliminado{" "}
                          {new Date(lead.deleted_at).toLocaleDateString("es-CL", { dateStyle: "medium" })}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRestoreLead(lead.id)}
                      disabled={restoringId !== null || isEmptyingPapelera}
                      className="shrink-0 gap-1.5"
                    >
                      {restoringId === lead.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Restaurar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t pt-4 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {papeleraLeads.length > 0 ? (
              <Button
                variant="destructive"
                onClick={() => void handleEmptyPapelera()}
                disabled={isEmptyingPapelera || restoringId !== null || loadingPapelera}
                className="w-full sm:w-auto gap-1.5"
              >
                {isEmptyingPapelera ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Vaciar papelera
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={() => setShowPapeleraDialog(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

