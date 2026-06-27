import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleMakeCombobox } from "@/components/VehicleMakeCombobox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useShortcutsPreferences } from "@/contexts/ShortcutsPreferencesContext";
import { AssignLeadMenu } from "@/components/leads/AssignLeadMenu";
import { LeadDelegationAdminBlock } from "@/components/leads/LeadDelegationAdminBlock";
import { LeadCrmQuickAppointmentPicker } from "@/components/crm/LeadCrmQuickAppointmentPicker";
import { LeadScheduleEventTag } from "@/components/crm/LeadScheduleEventTag";
import { LeadContactStateSelect } from "@/components/leads/LeadContactStateSelect";
import { LeadTransmissionSelect } from "@/components/leads/LeadTransmissionSelect";
import { CrmLeadContactTrackingBlock } from "@/components/crm/CrmLeadContactTrackingBlock";
import { VendorLoginGate } from "@/components/VendorLoginGate";
import { toast } from "@/hooks/use-toast";
import { useConsignaciones } from "@/hooks/useConsignaciones";
import { useDeletedLeads } from "@/hooks/useDeletedLeads";
import { useLeads } from "@/hooks/useLeads";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import {
  CRM_MOVABLE_STAGE_KEYS,
  CRM_PIPELINE_STAGES,
  CRM_PIPELINE_STATUS_LABELS,
  CRM_STAGE_BORDER_CLASS,
  CRM_STAGE_DOT_CLASS,
  CRM_STAGE_PILL_CLASS,
  CRM_STAGE_TEXT_CLASS,
  type CrmStageKey,
  crmStageToDbStatus,
  leadBelongsToCrmStage,
  safePipelineSelectValue,
} from "@/lib/crmPipeline";
import {
  formatLeadScheduleDisplayLine,
  parseCrmLeadQuickAppointmentMotive,
  pickActiveCrmLeadQuickAppointment,
  type AppointmentRow,
} from "@/lib/crmLeadQuickAppointment";
import {
  canSetLeadContactState,
  contactStateClearPatch,
  contactStateToPriority,
  shouldClearContactStateOnVendorExitNuevo,
  type LeadContactState,
} from "@/lib/leadContactState";
import { formatVehicleLabel, sanitizeName } from "@/lib/format";
import { leadTransmissionForForm, leadTransmissionForSave } from "@/lib/leadTransmission";
import { leadsAssignedToForQuery, leadsBranchIdForQuery } from "@/lib/leadsScope";
import { appointmentService } from "@/lib/services/appointments";
import { leadService } from "@/lib/services/leads";
import { leadNoteService } from "@/lib/services/leadNotes";
import { selectValidAttachments } from "@/lib/leadNoteAttachments";
import { supabase, type User } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Bell, ChevronDown, Download, Filter, ImagePlus, Loader2, Mail, Pencil, Phone, Plus, RefreshCw, RotateCcw, Search, Target, Trash2, X } from "lucide-react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const CONSIGNACION_TAG_PREFIX = "consignacion:";
const VEHICULO_TAG_PREFIX = "vehiculo:";
const REGION_TAG_PREFIX = "region:";
const MARCA_TAG_PREFIX = "marca:";
const MODELO_TAG_PREFIX = "modelo:";
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

/** Tags aplicando vehículo y origen (solo para edición de lead) */
const buildTagsWithVehicleAndOrigin = (
  tags: unknown,
  vehicle: string,
  origen: "lead" | "consignacion"
) => {
  let next = buildTagsWithVehicle(tags, vehicle);
  next = next.filter((tag) => !tag.startsWith(CONSIGNACION_TAG_PREFIX));
  if (origen === "consignacion") {
    const existing = normalizeTags(tags).find((t) => t.startsWith(CONSIGNACION_TAG_PREFIX));
    const label = existing ? existing.slice(CONSIGNACION_TAG_PREFIX.length) : "sin_etiqueta";
    next = [...next, `${CONSIGNACION_TAG_PREFIX}${label}`];
  }
  return next;
};

const normalizePhoneWithChilePrefix = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("+56")) {
    const normalized = raw.replace(/^(\+56\s*)/g, "+56 ").trim();
    return normalized === "+56" ? "" : normalized;
  }
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.startsWith("56") && digitsOnly.length >= 10) {
    const withoutCountry = digitsOnly.slice(2);
    return withoutCountry ? `+56 ${withoutCountry}` : "";
  }
  return `+56 ${raw}`;
};

const formatChilePhoneForDisplay = (value?: string | null) => {
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
};

const formatLeadTimestamp = (iso?: string | null) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
};

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const getRowValue = (row: Record<string, unknown>, keys: string[]) => {
  const normalizedMap = new Map<string, string>();
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key);
    if (normalizedMap.has(normalizedKey)) return;

    if (typeof value === "number" && Number.isFinite(value)) {
      normalizedMap.set(normalizedKey, Math.trunc(value).toString());
      return;
    }

    normalizedMap.set(normalizedKey, String(value ?? "").trim());
  });

  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    const value = normalizedMap.get(normalizedKey);
    if (value !== undefined && value !== "") return value;
  }

  return "";
};

const isTruthyResponse = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ["si", "sí", "s", "true", "1", "respondio", "respondió", "respondio?"].includes(normalized);
};

/** Quita caracteres de control que rompen el XML interno de .xlsx. */
const sanitizeForSpreadsheet = (value: unknown): string => {
  if (value == null) return "";
  // eslint-disable-next-line no-control-regex -- intencional: removemos control chars del payload de export.
  return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
};

/** Descarga binaria/texto sin depender de `writeFile` del navegador (más fiable con Vite). */
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
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

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const getConsignacionVehicleLabel = (item?: ConsignacionItem | null) => {
  if (!item) return "";
  if (item.vehicle) {
    return `${item.vehicle.year || ""} ${item.vehicle.make || ""} ${item.vehicle.model || ""}`.trim();
  }
  return `${item.vehicle_year || ""} ${item.vehicle_make || ""} ${item.vehicle_model || ""}`.trim();
};

/** Tipos de carrocería: dropdown del formulario de lead. Valores guardados en
 *  vehicle_interest (string libre en DB). Legacy free-text de leads previos se
 *  preserva agregándolo como opción extra en el form de editar. */
const VEHICLE_TYPE_OPTIONS = [
  "SUV",
  "CAMIONETA",
  "HATCHBACK",
  "SEDAN",
  "FURGON",
  "JEEP",
  "DEPORTIVO",
] as const;

/** Forma de pago. payment_type es string libre en DB; mantenemos las 2 opciones
 *  capitalizadas tal como aparecen en el resto del UI (CRM, exports). */
const PAYMENT_TYPE_OPTIONS = ["Financiamiento", "Contado"] as const;

/** Estados activos del pipeline (mismo modelo que CRM). */
const PIPELINE_STATUS_LABELS = CRM_PIPELINE_STATUS_LABELS;

const CLOSED_STATUS_LABELS: Record<string, string> = {
  vendido: "Cerrado (vendido)",
  perdido: "Cerrado (perdido)",
  cancelado: "Cancelado",
};

const CANCELLED_STATUS_LABELS: Record<string, string> = {
  cancelado: "CANCELADO",
};

type PipelineStatusStyle = { dot: string; text: string; pill: string; border: string };

const pipelineStyleFor = (stage: CrmStageKey): PipelineStatusStyle => ({
  dot: CRM_STAGE_DOT_CLASS[stage],
  text: CRM_STAGE_TEXT_CLASS[stage],
  pill: CRM_STAGE_PILL_CLASS[stage],
  border: CRM_STAGE_BORDER_CLASS[stage],
});

const PIPELINE_STYLES: Record<CrmStageKey, PipelineStatusStyle> = Object.fromEntries(
  CRM_PIPELINE_STAGES.map((stage) => [stage.key, pipelineStyleFor(stage.key)]),
) as Record<CrmStageKey, PipelineStatusStyle>;

const CLOSED_STYLES: Record<string, PipelineStatusStyle> = {
  vendido: {
    dot: "bg-emerald-600",
    text: "text-emerald-700 dark:text-emerald-300",
    pill: "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
    border: "border-emerald-600",
  },
  perdido: {
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-300",
    pill: "border-red-200/80 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200",
    border: "border-red-500",
  },
};

type LeadPipelineStage = CrmStageKey;

function getLeadPipelineStage(status?: string | null): LeadPipelineStage {
  return safePipelineSelectValue(status);
}

/** Bucket para filtro / stats: pipeline activo, cancelado o cerrado (vendido/perdido). */
type LeadStatusBucket = LeadPipelineStage | "cancelado" | "cerrado";

function getLeadStatusBucket(status?: string | null): LeadStatusBucket {
  const s = (status || "").toLowerCase();
  if (s === "cancelado") return "cancelado";
  if (s === "vendido" || s === "perdido") return "cerrado";
  return getLeadPipelineStage(status);
}

function isClosedLeadStatus(status?: string | null): boolean {
  const s = (status || "").toLowerCase();
  return s === "vendido" || s === "perdido";
}

/** Estado para el formulario de edición (clave de columna pipeline o perdido). */
function statusForEditForm(status?: string | null): string {
  const s = (status || "").toLowerCase();
  if (s === "perdido") return "perdido";
  return safePipelineSelectValue(status);
}

function pipelineSelectValueForForm(status: string): string {
  if (status.trim().toLowerCase() === "perdido") return "perdido";
  return safePipelineSelectValue(status);
}

const DEFAULT_PIPELINE_STYLE = PIPELINE_STYLES.en_seguimiento;

const getStatusMeta = (value?: string | null) => {
  const s = (value ?? "").trim().toLowerCase();
  if (s === "vendido") {
    return { label: CLOSED_STATUS_LABELS.vendido, styles: CLOSED_STYLES.vendido };
  }
  if (s === "perdido") {
    return { label: CLOSED_STATUS_LABELS.perdido, styles: CLOSED_STYLES.perdido };
  }
  if (s === "cancelado") {
    return { label: CANCELLED_STATUS_LABELS.cancelado, styles: PIPELINE_STYLES.cancelado };
  }
  const stage = getLeadPipelineStage(value);
  if (stage === "negocio_cerrado") {
    return {
      label: PIPELINE_STATUS_LABELS.negocio_cerrado,
      styles: CLOSED_STYLES.vendido,
    };
  }
  return {
    label: PIPELINE_STATUS_LABELS[stage] ?? PIPELINE_STATUS_LABELS.en_seguimiento,
    styles: PIPELINE_STYLES[stage] ?? DEFAULT_PIPELINE_STYLE,
  };
};

type LeadsTableProps = {
  loading: boolean;
  filteredLeads: Lead[];
  consignacionByLeadId: Map<string, ConsignacionItem>;
  selectedLeadIds: Set<string>;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleLead: (leadId: string) => void;
  handleStatusChange: (leadId: string, nextStatus: string) => void;
  openEditDialog: (lead: Lead) => void;
  openDeleteDialog: (lead: Lead) => void;
  openDetailsDialog: (lead: Lead) => void;
};

const LeadsTable = memo(function LeadsTable({
  loading,
  filteredLeads,
  consignacionByLeadId,
  selectedLeadIds,
  allSelected,
  onToggleSelectAll,
  onToggleLead,
  handleStatusChange,
  openEditDialog,
  openDeleteDialog,
  openDetailsDialog,
}: LeadsTableProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Lista de Leads
        </CardTitle>
        <CardDescription>
          Gestiona y sigue el progreso de tus leads
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-hidden overflow-y-visible p-0">
        <div className="min-w-0 w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 shrink-0">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => onToggleSelectAll()}
                    aria-label="Seleccionar todos los leads"
                  />
                </TableHead>
                <TableHead className="min-w-[120px]">Nombre</TableHead>
                <TableHead className="hidden min-w-[100px] sm:table-cell">RUT</TableHead>
                <TableHead className="min-w-[130px]">Contacto</TableHead>
                <TableHead className="hidden min-w-[90px] sm:table-cell">Origen</TableHead>
                <TableHead className="hidden min-w-[100px] md:table-cell">Vehiculo</TableHead>
                <TableHead className="hidden min-w-[100px] lg:table-cell">Región</TableHead>
                <TableHead className="hidden min-w-[100px] xl:table-cell">Financ./Contado</TableHead>
                <TableHead className="hidden min-w-[90px] xl:table-cell">Presupuesto</TableHead>
                <TableHead className="min-w-[180px]">Estado</TableHead>
                <TableHead className="hidden min-w-[80px] sm:table-cell">Fecha</TableHead>
                <TableHead className="text-right w-[130px] shrink-0">Acciones</TableHead>
              </TableRow>
            </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  Cargando leads...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No hay leads registrados
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  onClick={() => openDetailsDialog(lead)}
                  className="cursor-pointer"
                >
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedLeadIds.has(lead.id)}
                      onCheckedChange={() => onToggleLead(lead.id)}
                      aria-label={`Seleccionar lead ${lead.full_name || "sin nombre"}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="space-y-0.5">
                      <div>{sanitizeName(lead.full_name) || "Sin nombre"}</div>
                      {(() => {
                        const assignedUser = (lead as Lead & {
                          assigned_user?: { full_name?: string | null; email?: string | null } | null;
                        }).assigned_user;
                        const label = assignedUser?.full_name || assignedUser?.email;
                        if (!label) {
                          return (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" title="Lead sin vendedor asignado">
                              Sin asignar
                            </span>
                          );
                        }
                        return (
                          <div className="text-[11px] font-normal text-muted-foreground truncate" title={`Asignado a ${label}`}>
                            → {label}
                          </div>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {lead.rut?.trim() ? lead.rut : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{formatChilePhoneForDisplay(lead.phone) || "Sin telefono"}</span>
                      </div>
                      {lead.email ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {(() => {
                      const tags = normalizeTags(lead.tags);
                      const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
                      const label = isConsignacion ? "Consignacion" : "Lead";
                      return <Badge variant="secondary">{label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-[140px] truncate">
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
                  <TableCell className="hidden lg:table-cell">
                    {(() => {
                      const region = lead.region || getTagValue(lead.tags, REGION_TAG_PREFIX);
                      return region ? <Badge variant="secondary">{region}</Badge> : "—";
                    })()}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {(() => {
                      const label = lead.payment_type?.trim();
                      return label ? <Badge variant="secondary">{label}</Badge> : "—";
                    })()}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">{lead.budget || "—"}</TableCell>
                  <TableCell>
                    {(() => {
                      const meta = getStatusMeta(lead.status);
                      if (isClosedLeadStatus(lead.status)) {
                        return (
                          <span
                            className={cn(
                              "inline-flex h-8 items-center gap-2 rounded-full border px-3",
                              meta.styles.pill,
                            )}
                            title="Lead cerrado. Puedes cambiar el estado desde Editar."
                          >
                            <span className={`h-2 w-2 rounded-full ${meta.styles.dot}`} />
                            <span className={`text-xs font-medium ${meta.styles.text}`}>{meta.label}</span>
                          </span>
                        );
                      }
                      const selectValue = safePipelineSelectValue(lead.status);
                      return (
                        <Select
                          value={selectValue}
                          onValueChange={(value) => handleStatusChange(lead.id, value)}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8 w-auto gap-2 rounded-full border px-3",
                              meta.styles.pill,
                            )}
                            aria-label={`Estado ${meta.label}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className={`h-2 w-2 rounded-full ${meta.styles.dot}`} />
                            <span className={`text-xs font-medium ${meta.styles.text}`}>{meta.label}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {CRM_MOVABLE_STAGE_KEYS.map((key) => {
                              const label = PIPELINE_STATUS_LABELS[key];
                              const styles = PIPELINE_STYLES[key] ?? DEFAULT_PIPELINE_STYLE;
                              return (
                                <SelectItem key={key} value={key}>
                                  <span className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                                    <span className={styles.text}>{label}</span>
                                  </span>
                                </SelectItem>
                              );
                            })}
                            <SelectItem value="cancelado">
                              <span className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${PIPELINE_STYLES.cancelado.dot}`} />
                                <span className={PIPELINE_STYLES.cancelado.text}>
                                  {CANCELLED_STATUS_LABELS.cancelado}
                                </span>
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {new Date(lead.created_at).toLocaleDateString("es-CL")}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground shrink-0">
                    <div className="flex items-center justify-end gap-2">
                      <AssignLeadMenu
                        leadId={lead.id}
                        assignedTo={lead.assigned_to}
                        assignedLabel={(lead as Lead & {
                          assigned_user?: { full_name?: string | null; email?: string | null } | null;
                        }).assigned_user?.full_name ?? null}
                        leadBranchId={lead.branch_id}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditDialog(lead);
                        }}
                        aria-label="Editar lead"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDeleteDialog(lead);
                        }}
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
        </div>
      </CardContent>
    </Card>
  );
});

export default function Leads() {
  const { user } = useAuth();
  const location = useLocation();
  const vendorMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("vendor") === "1";
  }, [location.search]);

  if (vendorMode && user?.role !== "vendedor") {
    return (
      <VendorLoginGate
        title="Leads bloqueado"
        description="Inicia sesión con tu usuario de vendedor para ver tus leads."
        afterLoginPath="/app/leads"
      />
    );
  }
  if (!user) {
    return null;
  }
  return <LeadsImpl user={user} />;
}

function LeadsImpl({ user }: { user: User }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { shortcutsEnabled } = useShortcutsPreferences();
  const { leads, loading, isFetching, refetch } = useLeads({
    branchId: leadsBranchIdForQuery(user?.role, user?.branch_id),
    assignedTo: leadsAssignedToForQuery(user?.role, user?.id),
    enabled: !!user,
    live: true,
  });
  const { consignaciones } = useConsignaciones({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const createPreviews = useMemo(
    () => createFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [createFiles],
  );
  useEffect(() => {
    return () => createPreviews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [createPreviews]);
  const handlePickCreateFiles = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!list.length) return;
    setCreateFiles((prev) => {
      const { accepted, rejected } = selectValidAttachments({ files: list, existingCount: prev.length });
      if (rejected.length) toast({ variant: "destructive", title: "Imagen no agregada", description: rejected[0].reason });
      return accepted.length ? [...prev, ...accepted] : prev;
    });
  }, []);
  const removeCreateFile = useCallback((index: number) => {
    setCreateFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [formState, setFormState] = useState({
    full_name: "",
    rut: "",
    phone: "",
    status: "nuevo",
    make: "",
    vehicle: "",
    model: "",
    region: "",
    payment_type: "",
    budget: "",
    pie: "",
    cuotas_mensuales: "",
    transmision: "",
    notes: "",
    reminderEnabled: false,
    reminderDueDate: "",
    reminderPriority: "today" as "urgent" | "today" | "later",
    contact_state: null as LeadContactState | null,
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingLead, setEditingLead] = useState<(typeof leads)[number] | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
  /** Evita reabrir el modal al cerrar mientras `?id=` sigue en la URL un instante. */
  const deepLinkOpenedIdRef = useRef<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingLead, setDeletingLead] = useState<(typeof leads)[number] | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [showPapeleraDialog, setShowPapeleraDialog] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { deletedLeads, loading: loadingPapelera, refetch: refetchPapelera } = useDeletedLeads(showPapeleraDialog);
  const [editForm, setEditForm] = useState({
    full_name: "",
    rut: "",
    phone: "",
    email: "",
    status: "en_seguimiento",
    make: "",
    vehicle: "",
    model: "",
    region: "",
    payment_type: "",
    budget: "",
    pie: "",
    cuotas_mensuales: "",
    transmision: "",
    notes: "",
    origen: "lead" as "lead" | "consignacion",
    citaDayKey: null as string | null,
    citaMotivo: "",
    crmQuickAppointmentId: null as string | null,
    contact_state: null as LeadContactState | null,
  });
  const editCitaSyncedRef = useRef(false);

  const leadQuickAppointmentQuery = useQuery({
    queryKey: ["crmLeadQuickAppointment", editingLead?.id],
    enabled: Boolean(showEditDialog && editingLead?.id && user?.tenant_id),
    queryFn: async () => {
      const rows = await appointmentService.getAll({ leadId: editingLead!.id });
      return pickActiveCrmLeadQuickAppointment(rows as AppointmentRow[]);
    },
  });

  const detailsQuickAppointmentQuery = useQuery({
    queryKey: ["crmLeadQuickAppointment", detailsLead?.id],
    enabled: Boolean(showDetailsDialog && detailsLead?.id && user?.tenant_id),
    queryFn: async () => {
      const rows = await appointmentService.getAll({ leadId: detailsLead!.id });
      return pickActiveCrmLeadQuickAppointment(rows as AppointmentRow[]);
    },
  });

  useEffect(() => {
    if (!showEditDialog || !editingLead?.id) {
      editCitaSyncedRef.current = false;
      return;
    }
    if (!leadQuickAppointmentQuery.isFetched) return;
    if (editCitaSyncedRef.current) return;
    editCitaSyncedRef.current = true;

    const appt = leadQuickAppointmentQuery.data ?? null;
    setEditForm((f) => {
      if (!appt) {
        return { ...f, citaDayKey: null, citaMotivo: "", crmQuickAppointmentId: null };
      }
      const dayKey = format(parseISO(appt.scheduled_at), "yyyy-MM-dd");
      return {
        ...f,
        citaDayKey: dayKey,
        citaMotivo: parseCrmLeadQuickAppointmentMotive(appt.description),
        crmQuickAppointmentId: appt.id,
      };
    });
  }, [
    showEditDialog,
    editingLead?.id,
    leadQuickAppointmentQuery.isFetched,
    leadQuickAppointmentQuery.data?.id,
    leadQuickAppointmentQuery.data?.scheduled_at,
  ]);

  useEffect(() => {
    if (!shortcutsEnabled) return;

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
  }, [location.pathname, navigate, shortcutsEnabled, showCreateDialog]);

  useEffect(() => {
    if (user?.branch_id) {
      refetch();
    }
  }, [user?.branch_id, refetch]);

  // Cerrar todos los diálogos al desmontar (evita error removeChild en producción)
  useEffect(() => {
    return () => {
      setShowCreateDialog(false);
      setShowEditDialog(false);
      setShowDetailsDialog(false);
      setShowDeleteDialog(false);
      setShowBulkDeleteDialog(false);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "true") {
      setShowCreateDialog(true);
    }
  }, [location.search]);

  useEffect(() => {
    const handleOpenNewLeadForm = () => setShowCreateDialog(true);
    window.addEventListener("openNewLeadForm", handleOpenNewLeadForm);
    return () => window.removeEventListener("openNewLeadForm", handleOpenNewLeadForm);
  }, []);

  const resolvedStatusFilter = useMemo(() => {
    if (statusFilter === "all") return "all";
    if (statusFilter === "cancelado") return "cancelado";
    if ((CRM_MOVABLE_STAGE_KEYS as readonly string[]).includes(statusFilter)) {
      return statusFilter;
    }
    if (statusFilter === "cerrado") return "cerrado";
    return "all";
  }, [statusFilter]);

  const filteredLeads = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = !query
        || (lead.full_name || "").toLowerCase().includes(query)
        || (lead.email || "").toLowerCase().includes(query)
        || (lead.phone || "").toLowerCase().includes(query)
        || (lead.rut || "").toLowerCase().includes(query);

      const bucket = getLeadStatusBucket(lead.status);
      const matchesStatus =
        resolvedStatusFilter === "all"
          ? true
          : bucket === resolvedStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, deferredSearchQuery, resolvedStatusFilter]);

  const leadStats = useMemo(() => {
    const total = leads.length;
    const openLeads = leads.filter((l) => !isClosedLeadStatus(l.status));
    const countByStage = (key: CrmStageKey) =>
      openLeads.filter((lead) => getLeadPipelineStage(lead.status) === key).length;
    const cancelado = openLeads.filter((lead) => getLeadStatusBucket(lead.status) === "cancelado").length;
    return {
      total,
      cancelado,
      ...Object.fromEntries(CRM_PIPELINE_STAGES.map((s) => [s.key, countByStage(s.key)])),
    } as { total: number; cancelado: number } & Record<CrmStageKey, number>;
  }, [leads]);

  const {
    pagedItems: pagedLeads,
    page: leadsPage,
    setPage: setLeadsPage,
    pageSize: leadsPageSize,
    setPageSize: setLeadsPageSize,
    totalPages: leadsTotalPages,
    totalItems: leadsTotalItems,
  } = usePagination(filteredLeads, 25);

  const allFilteredSelected = filteredLeads.length > 0
    && filteredLeads.every((lead) => selectedLeadIds.has(lead.id));

  const handleToggleSelectAll = useCallback(() => {
    setSelectedLeadIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredLeads.forEach((lead) => next.delete(lead.id));
        return next;
      }
      const next = new Set(prev);
      filteredLeads.forEach((lead) => next.add(lead.id));
      return next;
    });
  }, [allFilteredSelected, filteredLeads]);

  const handleToggleLead = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }, []);

  const consignacionByLeadId = useMemo(() => {
    const map = new Map<string, ConsignacionItem>();
    (consignaciones as ConsignacionItem[]).forEach((item) => {
      if (item.lead_id) map.set(item.lead_id, item);
    });
    return map;
  }, [consignaciones]);

  const handleStatusChange = useCallback(async (leadId: string, nextStageKey: string) => {
    const currentLead = leads.find((item) => item.id === leadId);
    if (!currentLead) return;

    const targetStage = nextStageKey as CrmStageKey;
    if (leadBelongsToCrmStage(currentLead.status, targetStage)) return;

    const nextStatus = crmStageToDbStatus(targetStage);
    const clearContactState = shouldClearContactStateOnVendorExitNuevo(
      user?.role,
      currentLead.status,
      nextStatus,
    );

    // Optimistic update para evitar el doble intento
    queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
      if (!Array.isArray(current)) return current;
      return current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              status: nextStatus,
              ...(clearContactState ? contactStateClearPatch() : {}),
            }
          : lead,
      );
    });

    try {
      const statusUpdates: Record<string, unknown> = { status: nextStatus };
      if (clearContactState) Object.assign(statusUpdates, contactStateClearPatch());
      await leadService.update(leadId, statusUpdates as any);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (error: any) {
      console.error("Error actualizando estado del lead:", error);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ variant: "destructive", title: "Error", description: error?.message || "No se pudo actualizar el estado del lead." });
    }
  }, [leads, queryClient, user?.role]);

  const vehicleLabel = formState.vehicle.trim();

  const normalizedCreatePhone = useMemo(
    () => normalizePhoneWithChilePrefix(formState.phone),
    [formState.phone],
  );

  const resetForm = () => {
    setFormState({
      full_name: "",
      rut: "",
      phone: "",
      status: "nuevo",
      make: "",
      vehicle: "",
      model: "",
      region: "",
      payment_type: "",
      budget: "",
      pie: "",
      cuotas_mensuales: "",
      transmision: "",
      notes: "",
      reminderEnabled: false,
      reminderDueDate: tomorrow,
      reminderPriority: "today",
      contact_state: null,
    });
    setCreateFiles([]);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const resolvedBranchId = user?.branch_id || leads?.[0]?.branch_id || null;
    if (!resolvedBranchId) {
      toast({
        title: "No se pudo determinar la sucursal",
        description: "Abre la página con una sesión válida o selecciona una sucursal antes de importar.",
        variant: "destructive",
      });
      return;
    }
    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
        raw: false,
      });

      if (rows.length === 0) {
        toast({
          title: "Archivo vacío",
          description: "No se encontraron filas para importar.",
          variant: "destructive",
        });
        return;
      }

      let created = 0;
      let skipped = 0;
      let skippedMissingPhone = 0;

      for (const row of rows) {
      const rawFullName =
          getRowValue(row, ["nombre", "nombres", "full_name", "nombre completo"]) || "Sin nombre";
      const fullName = sanitizeName(rawFullName) || "Sin nombre";
        const rawPhone = getRowValue(row, ["telefono", "tel", "phone", "celular"]);
        const phone = normalizePhoneWithChilePrefix(rawPhone);
        const rawVehicle = getRowValue(row, ["vehiculo", "vehículo", "auto", "modelo"]);
        const vehicle =
          rawVehicle && rawVehicle.trim().toLowerCase() !== "por definir"
            ? formatVehicleLabel(rawVehicle.trim())
            : "";
        const region = getRowValue(row, ["region", "región"]);
        const city = getRowValue(row, ["ciudad"]);
        const rut = getRowValue(row, ["rut"]);
        const paymentType = getRowValue(row, ["financiamiento/contado", "financiamiento", "contado"]);
        const rawValorVehiculo = getRowValue(row, ["valor vehiculo", "valorvehiculo", "valor vehículo"]);
        const valorVehiculo =
          rawValorVehiculo && rawValorVehiculo.trim().toLowerCase() !== "por definir"
            ? rawValorVehiculo
            : "";
        const responded = isTruthyResponse(getRowValue(row, ["respondio?", "respondió?", "respondio", "respondió", "respondio ?"]));

        if (!phone) {
          skipped += 1;
          skippedMissingPhone += 1;
          continue;
        }

        const hasExtraInfo = Boolean(region || city || rut);
        const status = !responded ? "en_seguimiento" : hasExtraInfo ? "negociando" : "en_seguimiento";

        const tags: string[] = [];
        if (vehicle) {
          tags.push(`${VEHICULO_TAG_PREFIX}${vehicle}`);
        }

        const notes = valorVehiculo ? `Valor vehículo: ${valorVehiculo}` : null;

        try {
          await leadService.create({
            full_name: fullName,
            phone,
            status: status as any,
            source: "telefono",
            priority: "media",
            tenant_id: user?.tenant_id ?? null,
            branch_id: resolvedBranchId,
            assigned_to: user?.role === "vendedor" ? user.id : null,
            rut: rut?.trim() || null,
            region: region || null,
            payment_type: paymentType || null,
            notes,
            tags: buildTags(tags) as any,
          });
          created += 1;
        } catch (error) {
          console.error("Error importando lead:", error);
          skipped += 1;
        }
      }

      await refetch();
      toast({
        title: "Importación finalizada",
        description: `Creados: ${created}. Omitidos: ${skipped}. ${skippedMissingPhone ? `Sin teléfono: ${skippedMissingPhone}.` : ""}`,
      });
    } catch (error) {
      console.error("Error procesando XLSX:", error);
      toast({
        title: "Error al importar",
        description: "No se pudo procesar el archivo XLSX.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportLeads = useCallback(
    (pipelineStage: LeadPipelineStage) => {
      const query = deferredSearchQuery.trim().toLowerCase();
      const toExport = leads.filter((lead) => {
        if (isClosedLeadStatus(lead.status)) return false;
        if (getLeadPipelineStage(lead.status) !== pipelineStage) return false;
        if (!query) return true;
        return (
          (lead.full_name || "").toLowerCase().includes(query)
          || (lead.email || "").toLowerCase().includes(query)
          || (lead.phone || "").toLowerCase().includes(query)
          || (lead.rut || "").toLowerCase().includes(query)
        );
      });

      if (toExport.length === 0) {
        toast({
          title: "Nada que exportar",
          description: `No hay leads en «${PIPELINE_STATUS_LABELS[pipelineStage]}» con la búsqueda actual.`,
          variant: "destructive",
        });
        return;
      }

      const rows: Record<string, string>[] = toExport.map((lead) => {
        const tags = normalizeTags(lead.tags);
        const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
        const tipoOrigen = isConsignacion ? "Consignación" : "Lead";
        let vehiculo = "";
        if (isConsignacion) {
          const consignacion = consignacionByLeadId.get(lead.id);
          vehiculo =
            getConsignacionVehicleLabel(consignacion) || getTagValue(tags, VEHICULO_TAG_PREFIX) || "";
        } else {
          vehiculo = getTagValue(tags, VEHICULO_TAG_PREFIX) || "";
        }
        const region = lead.region || getTagValue(tags, REGION_TAG_PREFIX) || "";

        return {
          Nombre: sanitizeForSpreadsheet(lead.full_name || ""),
          RUT: sanitizeForSpreadsheet(lead.rut?.trim() || ""),
          Teléfono: sanitizeForSpreadsheet(formatChilePhoneForDisplay(lead.phone) || lead.phone || ""),
          Email: sanitizeForSpreadsheet(lead.email || ""),
          Tipo: sanitizeForSpreadsheet(tipoOrigen),
          Marca: sanitizeForSpreadsheet(getTagValue(tags, MARCA_TAG_PREFIX) || ""),
          Modelo: sanitizeForSpreadsheet(getTagValue(tags, MODELO_TAG_PREFIX) || ""),
          Vehículo: sanitizeForSpreadsheet(vehiculo),
          Región: sanitizeForSpreadsheet(region),
          "Financiamiento/Contado": sanitizeForSpreadsheet(lead.payment_type || ""),
          Presupuesto: sanitizeForSpreadsheet(lead.budget || ""),
          Pie: sanitizeForSpreadsheet(lead.pie_disponible || ""),
          "Cuotas mensuales": sanitizeForSpreadsheet(lead.cuotas_mensuales || ""),
          Estado: sanitizeForSpreadsheet(getStatusMeta(lead.status).label),
          Fuente: sanitizeForSpreadsheet(lead.source || ""),
          Notas: sanitizeForSpreadsheet(lead.notes || ""),
          "Fecha creación": sanitizeForSpreadsheet(new Date(lead.created_at).toLocaleString("es-CL")),
        };
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const stageSlug =
        pipelineStage === "para_cierre"
          ? "para-cierre"
          : pipelineStage === "en_espera"
            ? "en-espera"
            : pipelineStage;
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
      const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array", bookSST: false });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBlob(blob, `leads-${stageSlug}-${dateStr}.xlsx`);

      toast({
        title: "Excel descargado",
        description: `${PIPELINE_STATUS_LABELS[pipelineStage]}: ${rows.length} fila${rows.length === 1 ? "" : "s"}.`,
      });
    },
    [leads, deferredSearchQuery, consignacionByLeadId],
  );

  const handleCreateLead = async () => {
    if (!user) {
      toast({
        title: "Sesión no disponible",
        description: "Inicia sesión de nuevo para crear leads.",
        variant: "destructive",
      });
      return;
    }
    const sanitizedCreateName = sanitizeName(formState.full_name);
    const missing: string[] = [];
    if (!sanitizedCreateName) missing.push("nombre");
    if (!formState.phone.trim()) missing.push("teléfono");
    else if (!normalizedCreatePhone) {
      toast({
        title: "Teléfono no válido",
        description: "Ingresa un número válido (ej: 9 1234 5678).",
        variant: "destructive",
      });
      return;
    }
    if (!formState.status) missing.push("estado");
    if (missing.length > 0) {
      toast({
        title: "Faltan datos obligatorios",
        description: `Completa: ${missing.join(", ")}. Están al inicio del formulario (arriba de Vehículo).`,
        variant: "destructive",
      });
      return;
    }

    if (!user.tenant_id && !user.branch_id) {
      toast({
        title: "Falta sucursal o empresa",
        description:
          "Tu usuario no tiene sucursal ni tenant asignados. Configúralos en Ajustes / perfil o pide ayuda a un administrador.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    // Si adjunta imágenes, el texto + imágenes van como primera nota del timeline (lead_notes),
    // no al campo notes del lead, para no duplicar el texto en la UI. Requiere tenant_id.
    const attachImages = createFiles.length > 0 && !!user.tenant_id;

    try {
      const tags: string[] = [];
      if (vehicleLabel) {
        tags.push(`${VEHICULO_TAG_PREFIX}${vehicleLabel}`);
      }
      if (formState.make.trim()) {
        tags.push(`${MARCA_TAG_PREFIX}${formState.make.trim()}`);
      }
      if (formState.model.trim()) {
        tags.push(`${MODELO_TAG_PREFIX}${formState.model.trim()}`);
      }

      const created = await leadService.create({
        full_name: sanitizedCreateName,
        phone: normalizedCreatePhone,
        status: formState.status as any,
        source: formState.phone.trim() ? "telefono" : "otro",
        priority:
          canSetLeadContactState(user?.role) && formState.contact_state != null
            ? contactStateToPriority(formState.contact_state)
            : "media",
        contact_state: canSetLeadContactState(user?.role) ? formState.contact_state : null,
        tenant_id: user.tenant_id ?? null,
        branch_id: user.branch_id,
        assigned_to: user.role === "vendedor" ? user.id : null,
        rut: formState.rut.trim() ? formState.rut.trim() : null,
        region: formState.region.trim() ? formState.region.trim() : null,
        payment_type: formState.payment_type ? formState.payment_type : null,
        budget: formState.budget.trim() ? formState.budget.trim() : null,
        pie_disponible: formState.pie.trim() ? formState.pie.trim() : null,
        cuotas_mensuales: formState.cuotas_mensuales.trim() ? formState.cuotas_mensuales.trim() : null,
        transmision: leadTransmissionForSave(formState.transmision),
        notes: !attachImages && formState.notes.trim() ? formState.notes.trim() : null,
        tags: buildTags(tags) as any,
      });

      if (attachImages && user.tenant_id) {
        try {
          await leadNoteService.create({
            leadId: (created as Lead).id,
            body: formState.notes.trim(),
            tenantId: user.tenant_id,
            branchId: user.branch_id,
            createdBy: user.id,
            channel: null,
            files: createFiles,
          });
          queryClient.invalidateQueries({ queryKey: ["lead-notes", (created as Lead).id] });
        } catch (noteError: any) {
          console.error("Error guardando nota con imágenes:", noteError);
          toast({
            variant: "destructive",
            title: "Lead creado, pero la nota con imágenes falló",
            description: noteError?.message || "Vuelve a adjuntar las imágenes desde la ficha del lead.",
          });
        }
      }

      // Actualizar caché al instante con el nuevo lead al inicio (mismo orden que el API: más recientes primero)
      const queryKey = ["leads", user.branch_id, undefined, undefined, undefined, undefined];
      queryClient.setQueryData(queryKey, (old: Lead[] | undefined) => {
        if (!Array.isArray(old)) return [created as Lead];
        return [created as Lead, ...old.filter((l) => l.id !== (created as Lead).id)];
      });
      // Marcar como obsoleta y volver a cargar desde el servidor para asegurar lista actualizada
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      await refetch();

      // Si el usuario activó recordatorio: guardar en lead_reminders (aparece en Tareas pendientes cuando falte poco)
      if (formState.reminderEnabled && user?.branch_id) {
        const dueDate = formState.reminderDueDate || tomorrow;
        const dueAt = `${dueDate}T09:00:00.000Z`;
        const { error: reminderError } = await supabase.from("lead_reminders").insert({
          lead_id: (created as Lead).id,
          branch_id: user.branch_id,
          reminder_at: dueAt,
          note: formState.notes.trim() ? formState.notes.trim() : null,
          priority: formState.reminderPriority,
        });
        if (reminderError) {
          console.error("Error creando recordatorio:", reminderError);
          toast({ title: "Lead creado", description: "El recordatorio no pudo guardarse.", variant: "destructive" });
        } else {
          queryClient.invalidateQueries({ queryKey: ["pending-tasks"] });
          toast({
            title: "Lead creado",
            description: "Se creó el lead y el recordatorio. Aparecerá en Tareas pendientes cuando falte poco para la fecha.",
          });
        }
      }

      resetForm();
      setShowCreateDialog(false);
    } catch (error: any) {
      console.error("Error creando lead:", error);
      const msg =
        error?.message || error?.error_description || "No se pudo crear el lead.";
      toast({
        title: "Error al crear el lead",
        description: msg.includes("row-level security") || msg.includes("RLS")
          ? "Permisos denegados (RLS). Verifica sucursal/tenant en tu perfil o que la migración de políticas de leads esté aplicada."
          : msg,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = useCallback((lead: Lead) => {
    editCitaSyncedRef.current = false;
    const tags = normalizeTags(lead.tags);
    const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
    const consignacion = consignacionByLeadId.get(lead.id);
    const consignacionVehicle = getConsignacionVehicleLabel(consignacion);
    setEditingLead(lead);
    setEditForm({
      full_name: lead.full_name || "",
      rut: lead.rut || "",
      phone: (lead.phone || "").replace(/^(\+56\s*)/g, ""),
      email: lead.email || "",
      status: statusForEditForm(lead.status),
      make: getTagValue(tags, MARCA_TAG_PREFIX),
      model: getTagValue(tags, MODELO_TAG_PREFIX),
      vehicle: isConsignacion
        ? consignacionVehicle || getTagValue(tags, VEHICULO_TAG_PREFIX)
        : getTagValue(tags, VEHICULO_TAG_PREFIX),
      region: lead.region || getTagValue(tags, REGION_TAG_PREFIX),
      payment_type: lead.payment_type || "",
      budget: lead.budget || "",
      pie: lead.pie_disponible || "",
      cuotas_mensuales: lead.cuotas_mensuales || "",
      transmision: leadTransmissionForForm(lead.transmision),
      notes: lead.notes || "",
      origen: isConsignacion ? "consignacion" : "lead",
      citaDayKey: null,
      citaMotivo: "",
      crmQuickAppointmentId: null,
      contact_state: lead.contact_state ?? null,
    });
    setShowEditDialog(true);
  }, [consignacionByLeadId]);

  const closeEditDialog = () => {
    setShowEditDialog(false);
    setEditingLead(null);
  };

  const handleUpdateLead = async () => {
    if (!editingLead) return;
    setIsUpdating(true);

    try {
      const updates: Record<string, any> = {
        full_name: sanitizeName(editForm.full_name) || "Sin nombre",
        phone: normalizePhoneWithChilePrefix(editForm.phone) || "sin_telefono",
        email: editForm.email.trim() ? editForm.email.trim() : null,
        rut: editForm.rut.trim() ? editForm.rut.trim() : null,
        status: crmStageToDbStatus(editForm.status) as Lead["status"],
        region: editForm.region.trim() ? editForm.region.trim() : null,
        payment_type: editForm.payment_type ? editForm.payment_type : null,
        budget: editForm.budget.trim() ? editForm.budget.trim() : null,
        pie_disponible: editForm.pie.trim() ? editForm.pie.trim() : null,
        cuotas_mensuales: editForm.cuotas_mensuales.trim() ? editForm.cuotas_mensuales.trim() : null,
        transmision: leadTransmissionForSave(editForm.transmision),
        notes: editForm.notes.trim() ? editForm.notes.trim() : null,
        ...(canSetLeadContactState(user?.role)
          ? {
              contact_state: editForm.contact_state,
              ...(editForm.contact_state != null
                ? { priority: contactStateToPriority(editForm.contact_state) }
                : {}),
            }
          : {}),
      };

      // Preservar/actualizar tag marca:X aparte (no lo maneja buildTagsWithVehicleAndOrigin).
      let nextTags = buildTagsWithVehicleAndOrigin(
        editingLead.tags,
        editForm.vehicle,
        editForm.origen,
      );
      nextTags = nextTags.filter((t) => !t.startsWith(MARCA_TAG_PREFIX));
      const trimmedMake = editForm.make.trim();
      if (trimmedMake) nextTags = [...nextTags, `${MARCA_TAG_PREFIX}${trimmedMake}`];
      nextTags = nextTags.filter((t) => !t.startsWith(MODELO_TAG_PREFIX));
      const trimmedModel = editForm.model.trim();
      if (trimmedModel) nextTags = [...nextTags, `${MODELO_TAG_PREFIX}${trimmedModel}`];
      updates.tags = nextTags as any;

      const updated = await leadService.update(editingLead.id, updates);

      await appointmentService.upsertCrmLeadQuickAppointment({
        leadId: editingLead.id,
        leadDisplayName: editForm.full_name.trim() || editingLead.full_name || "Lead",
        tenantId: editingLead.tenant_id ?? user?.tenant_id ?? null,
        branchId: editingLead.branch_id ?? user?.branch_id ?? null,
        userId: user?.id ?? null,
        existingId: editForm.crmQuickAppointmentId,
        dayKey: editForm.citaDayKey,
        motive: editForm.citaMotivo,
      });
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.invalidateQueries({ queryKey: ["crmLeadQuickAppointment", editingLead.id] });

      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead));
      });
      closeEditDialog();
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (editForm.citaDayKey) {
        toast({
          title: "Fecha guardada",
          description: `${formatLeadScheduleDisplayLine(
            new Date(`${editForm.citaDayKey}T10:00:00`).toISOString(),
            editForm.citaMotivo,
          )} · visible en Citas`,
        });
      }
    } catch (error: any) {
      console.error("Error actualizando lead:", error);
      toast({ variant: "destructive", title: "Error", description: error?.message || "No se pudo actualizar el lead." });
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteDialog = useCallback((lead: Lead) => {
    setDeletingLead(lead);
    setShowDeleteDialog(true);
  }, []);

  const openDetailsDialog = useCallback((lead: Lead) => {
    setDetailsLead(lead);
    setShowDetailsDialog(true);
  }, []);

  const leadIdFromUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("id") || params.get("openLead");
  }, [location.search]);

  useEffect(() => {
    if (!leadIdFromUrl) {
      deepLinkOpenedIdRef.current = null;
      return;
    }
    if (loading) return;
    if (deepLinkOpenedIdRef.current === leadIdFromUrl) return;

    const openFromDeepLink = (lead: Lead) => {
      deepLinkOpenedIdRef.current = leadIdFromUrl;
      openDetailsDialog(lead);
    };

    const fromList = leads.find((l) => l.id === leadIdFromUrl);
    if (fromList) {
      openFromDeepLink(fromList);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const lead = await leadService.getById(leadIdFromUrl);
        if (!cancelled && deepLinkOpenedIdRef.current !== leadIdFromUrl) {
          openFromDeepLink(lead);
        }
      } catch {
        if (cancelled) return;
        deepLinkOpenedIdRef.current = leadIdFromUrl;
        toast({
          variant: "destructive",
          title: "Lead no encontrado",
          description: "No se pudo abrir el detalle de este lead.",
        });
        const params = new URLSearchParams(location.search);
        params.delete("id");
        params.delete("openLead");
        const q = params.toString();
        navigate(`${location.pathname}${q ? `?${q}` : ""}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leadIdFromUrl, loading, leads, location.pathname, location.search, navigate, openDetailsDialog]);

  const closeDetailsDialog = useCallback(() => {
    const params = new URLSearchParams(location.search);
    const idInUrl = params.get("id") || params.get("openLead");
    if (idInUrl) {
      deepLinkOpenedIdRef.current = idInUrl;
      params.delete("id");
      params.delete("openLead");
      const q = params.toString();
      navigate(`${location.pathname}${q ? `?${q}` : ""}`, { replace: true });
    }
    setShowDetailsDialog(false);
    setDetailsLead(null);
  }, [location.pathname, location.search, navigate]);

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
      toast({ variant: "destructive", title: "Error", description: error?.message || "No se pudo eliminar el lead." });
    }
  };

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;
    setIsDeletingBulk(true);
    try {
      for (const id of ids) {
        await leadService.delete(id);
      }
      setSelectedLeadIds(new Set());
      setShowBulkDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      await refetch();
      toast({
        title: "Leads eliminados",
        description: `Se eliminaron ${ids.length} lead${ids.length === 1 ? "" : "s"} correctamente.`,
      });
    } catch (error: unknown) {
      console.error("Error eliminando leads:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudieron eliminar algunos leads.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingBulk(false);
    }
  }, [selectedLeadIds, queryClient, refetch]);

  const handleRestoreLead = useCallback(
    async (id: string) => {
      setRestoringId(id);
      try {
        await leadService.restore(id);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        await refetch();
        await refetchPapelera();
        toast({
          title: "Lead restaurado",
          description: "El lead volvió a la lista de leads.",
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
    <div className="space-y-6 min-w-0 w-full overflow-x-hidden">
      {isImporting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-5 shadow-lg">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Importando leads...</p>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus leads y oportunidades de venta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPapeleraDialog(true)}
            title="Ver papelera — clientes eliminados (no respondieron)"
            aria-label="Ver papelera"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleImportClick} disabled={isImporting}>
            {isImporting ? "Importando..." : "Importar leads"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={loading || isImporting}
                title="Exportar a Excel por etapa del pipeline (respeta la búsqueda)"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
                <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Exportar por estado</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CRM_MOVABLE_STAGE_KEYS.map((key) => (
                <DropdownMenuItem key={key} onSelect={() => handleExportLeads(key)}>
                  {PIPELINE_STATUS_LABELS[key]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => handleExportLeads("cancelado")}>
                {CANCELLED_STATUS_LABELS.cancelado}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Lead
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Card className="border-l-4 border-slate-400">
          <CardHeader className="pb-2">
            <CardDescription>Leads total</CardDescription>
            <CardTitle className="text-2xl text-slate-700">{leadStats.total}</CardTitle>
          </CardHeader>
        </Card>
        {CRM_PIPELINE_STAGES.filter((s) => s.key !== "negocio_cerrado").map((stage) => (
          <Card key={stage.key} className={cn("border-l-4", CRM_STAGE_BORDER_CLASS[stage.key])}>
            <CardHeader className="pb-2">
              <CardDescription>{stage.label}</CardDescription>
              <CardTitle className={cn("text-2xl", CRM_STAGE_TEXT_CLASS[stage.key])}>
                {leadStats[stage.key]}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
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
            <Select value={resolvedStatusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {CRM_MOVABLE_STAGE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {PIPELINE_STATUS_LABELS[key]}
                  </SelectItem>
                ))}
                <SelectItem value="cancelado">{CANCELLED_STATUS_LABELS.cancelado}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="shrink-0"
              title="Actualizar lista de leads"
              aria-label="Actualizar lista de leads"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedLeadIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            {selectedLeadIds.size} lead{selectedLeadIds.size === 1 ? "" : "s"} seleccionado{selectedLeadIds.size === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedLeadIds(new Set())}
            >
              Deseleccionar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Eliminar seleccionados
            </Button>
          </div>
        </div>
      )}

      <LeadsTable
        loading={loading}
        filteredLeads={pagedLeads}
        consignacionByLeadId={consignacionByLeadId}
        selectedLeadIds={selectedLeadIds}
        allSelected={allFilteredSelected}
        onToggleSelectAll={handleToggleSelectAll}
        onToggleLead={handleToggleLead}
        handleStatusChange={handleStatusChange}
        openEditDialog={openEditDialog}
        openDeleteDialog={openDeleteDialog}
        openDetailsDialog={openDetailsDialog}
      />

      <PaginationControls
        page={leadsPage}
        totalPages={leadsTotalPages}
        pageSize={leadsPageSize}
        totalItems={leadsTotalItems}
        onPageChange={setLeadsPage}
        onPageSizeChange={setLeadsPageSize}
      />

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open && location.search) {
            navigate(location.pathname, { replace: true });
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nuevo lead</DialogTitle>
            <DialogDescription>
              Completa los datos básicos para registrar un lead.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 grid gap-4 overflow-y-auto min-h-0 py-1 -mx-1 px-1">
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
              <Label htmlFor="lead_rut">RUT</Label>
              <Input
                id="lead_rut"
                value={formState.rut}
                onChange={(e) => setFormState({ ...formState, rut: e.target.value })}
                placeholder="Ej: 12.345.678-9"
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
            {canSetLeadContactState(user?.role) && (
              <LeadContactStateSelect
                value={formState.contact_state}
                localOnly
                disabled={isCreating}
                onChange={(next) => setFormState({ ...formState, contact_state: next })}
              />
            )}
            {user?.role !== "admin" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="lead_make">Marca</Label>
                  <VehicleMakeCombobox
                    id="lead_make"
                    value={formState.make}
                    onChange={(value) => setFormState({ ...formState, make: value })}
                    placeholder="Selecciona o escribe la marca"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lead_model">Modelo</Label>
                  <Input
                    id="lead_model"
                    value={formState.model}
                    onChange={(e) => setFormState({ ...formState, model: e.target.value })}
                    placeholder="Ej: Corolla, Ranger, 208…"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lead_vehicle">Vehiculo</Label>
                  <Select
                    value={formState.vehicle}
                    onValueChange={(value) => setFormState({ ...formState, vehicle: value })}
                  >
                    <SelectTrigger id="lead_vehicle">
                      <SelectValue placeholder="Selecciona tipo de vehículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>Región</Label>
              <Input
                value={formState.region}
                onChange={(e) => setFormState({ ...formState, region: e.target.value })}
                placeholder="Ej: Metropolitana de Santiago"
              />
            </div>
            {user?.role !== "admin" && (
              <>
                <LeadTransmissionSelect
                  id="lead-create-transmision"
                  value={formState.transmision}
                  onChange={(transmision) => setFormState({ ...formState, transmision })}
                  disabled={isCreating}
                />
                <div className="grid gap-2">
                  <Label>Financiamiento/Contado</Label>
                  <Select
                    value={formState.payment_type}
                    onValueChange={(value) =>
                      setFormState({ ...formState, payment_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona forma de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="lead-create-budget">Presupuesto</Label>
                <Input
                  id="lead-create-budget"
                  value={formState.budget}
                  onChange={(e) => setFormState({ ...formState, budget: e.target.value })}
                  placeholder="Ej: 10-12 millones"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-create-pie">Pie</Label>
                <Input
                  id="lead-create-pie"
                  value={formState.pie}
                  onChange={(e) => setFormState({ ...formState, pie: e.target.value })}
                  placeholder="Ej: 2.500.000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-create-cuotas">Cuotas mensuales</Label>
                <Input
                  id="lead-create-cuotas"
                  value={formState.cuotas_mensuales}
                  onChange={(e) => setFormState({ ...formState, cuotas_mensuales: e.target.value })}
                  placeholder="Ej: 350.000"
                />
                <p className="text-[11px] text-muted-foreground">Cuota que el cliente está dispuesto a pagar.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Nota</Label>
              <Textarea
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Agrega una nota sobre el lead..."
                rows={3}
              />
              <input
                ref={createFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePickCreateFiles}
                disabled={isCreating}
              />
              {createPreviews.length ? (
                <div className="flex flex-wrap gap-2">
                  {createPreviews.map((preview, index) => (
                    <div
                      key={preview.url}
                      className="relative h-16 w-16 overflow-hidden rounded-md border border-border/50 bg-muted"
                    >
                      <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeCreateFile(index)}
                        disabled={isCreating}
                        className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground shadow hover:bg-background"
                        aria-label={`Quitar ${preview.file.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => createFileInputRef.current?.click()}
                  disabled={isCreating}
                >
                  <ImagePlus className="mr-1 h-4 w-4" aria-hidden />
                  Adjuntar imágenes
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Hasta 6 imágenes. Se guardan como primera nota del lead.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select value={formState.status} onValueChange={(value) => setFormState({ ...formState, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  {CRM_MOVABLE_STAGE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {PIPELINE_STATUS_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 rounded-lg border border-dashed p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="lead_reminder"
                  checked={formState.reminderEnabled}
                  onCheckedChange={(checked) =>
                    setFormState({
                      ...formState,
                      reminderEnabled: !!checked,
                      reminderDueDate: formState.reminderDueDate || tomorrow,
                    })
                  }
                />
                <Label htmlFor="lead_reminder" className="flex items-center gap-1.5 cursor-pointer font-normal">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Crear recordatorio (aparece en Tareas pendientes del Dashboard)
                </Label>
              </div>
              {formState.reminderEnabled && (
                <div className="grid gap-2 sm:grid-cols-2 pl-6">
                  <div className="grid gap-1.5">
                    <Label htmlFor="lead_reminder_date" className="text-xs">Fecha recordatorio</Label>
                    <Input
                      id="lead_reminder_date"
                      type="date"
                      value={formState.reminderDueDate || tomorrow}
                      min={today}
                      onChange={(e) => setFormState({ ...formState, reminderDueDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="lead_reminder_priority" className="text-xs">Prioridad</Label>
                    <Select
                      value={formState.reminderPriority}
                      onValueChange={(value: "urgent" | "today" | "later") =>
                        setFormState({ ...formState, reminderPriority: value })
                      }
                    >
                      <SelectTrigger id="lead_reminder_priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="today">Hoy</SelectItem>
                        <SelectItem value="later">Después</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-xs text-muted-foreground order-last sm:order-first sm:mr-auto sm:text-left w-full sm:w-auto">
              Obligatorios: <span className="font-medium text-foreground">nombre</span> y{" "}
              <span className="font-medium text-foreground">teléfono</span> (campos al inicio del formulario).
            </p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleCreateLead()} disabled={isCreating}>
                {isCreating ? "Guardando..." : "Crear lead"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={(open) => (open ? null : closeEditDialog())}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Editar lead</DialogTitle>
            <DialogDescription>
              Actualiza los datos principales del lead.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 grid gap-4 overflow-y-auto min-h-0 py-1 -mx-1 px-1">
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
            {canSetLeadContactState(user?.role) && (
              <LeadContactStateSelect
                value={editForm.contact_state}
                localOnly
                disabled={isUpdating}
                onChange={(next) => setEditForm({ ...editForm, contact_state: next })}
              />
            )}
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
              <Label htmlFor="edit_lead_rut">RUT</Label>
              <Input
                id="edit_lead_rut"
                value={editForm.rut}
                onChange={(e) => setEditForm({ ...editForm, rut: e.target.value })}
                placeholder="Ej: 12.345.678-9"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_lead_make">Marca</Label>
              <VehicleMakeCombobox
                id="edit_lead_make"
                value={editForm.make}
                onChange={(value) => setEditForm({ ...editForm, make: value })}
                placeholder="Selecciona o escribe la marca"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_lead_model">Modelo</Label>
              <Input
                id="edit_lead_model"
                value={editForm.model}
                onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                placeholder="Ej: Corolla, Ranger, 208…"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_lead_vehicle">Vehiculo</Label>
              <Select
                value={editVehicleValue}
                onValueChange={(value) => setEditForm({ ...editForm, vehicle: value })}
              >
                <SelectTrigger id="edit_lead_vehicle">
                  <SelectValue placeholder="Selecciona tipo de vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                  {/* Preservar valor legacy free-text (ej: "Toyota Corolla 2020") para no perderlo al editar. */}
                  {editVehicleValue &&
                    !VEHICLE_TYPE_OPTIONS.includes(
                      editVehicleValue as (typeof VEHICLE_TYPE_OPTIONS)[number],
                    ) && (
                      <SelectItem value={editVehicleValue}>
                        {editVehicleValue} (anterior)
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Origen</Label>
              <Select
                value={editForm.origen}
                onValueChange={(value: "lead" | "consignacion") =>
                  setEditForm({ ...editForm, origen: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Origen del lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="consignacion">Consignación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Región</Label>
              <Input
                value={editForm.region}
                onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                placeholder="Ej: Metropolitana de Santiago"
              />
            </div>
            <LeadTransmissionSelect
              id="lead-edit-transmision"
              value={editForm.transmision}
              onChange={(transmision) => setEditForm({ ...editForm, transmision })}
              disabled={isUpdating}
            />
            <div className="grid gap-2">
              <Label>Financiamiento/Contado</Label>
              <Select
                value={editForm.payment_type}
                onValueChange={(value) => setEditForm({ ...editForm, payment_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                  {/* Preservar valor legacy free-text para no perderlo al editar. */}
                  {editForm.payment_type &&
                    !PAYMENT_TYPE_OPTIONS.includes(
                      editForm.payment_type as (typeof PAYMENT_TYPE_OPTIONS)[number],
                    ) && (
                      <SelectItem value={editForm.payment_type}>
                        {editForm.payment_type} (anterior)
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="lead-edit-budget">Presupuesto</Label>
                <Input
                  id="lead-edit-budget"
                  value={editForm.budget}
                  onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                  placeholder="Ej: 10-12 millones"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-edit-pie">Pie</Label>
                <Input
                  id="lead-edit-pie"
                  value={editForm.pie}
                  onChange={(e) => setEditForm({ ...editForm, pie: e.target.value })}
                  placeholder="Ej: 2.500.000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-edit-cuotas">Cuotas mensuales</Label>
                <Input
                  id="lead-edit-cuotas"
                  value={editForm.cuotas_mensuales}
                  onChange={(e) => setEditForm({ ...editForm, cuotas_mensuales: e.target.value })}
                  placeholder="Ej: 350.000"
                />
                <p className="text-[11px] text-muted-foreground">Cuota que el cliente está dispuesto a pagar.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Nota</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Agrega una nota sobre el lead..."
                rows={3}
              />
            </div>
            <LeadCrmQuickAppointmentPicker
              id="leads-edit-cita"
              dayKey={editForm.citaDayKey}
              motive={editForm.citaMotivo}
              onDayChange={(dayKey) =>
                setEditForm({
                  ...editForm,
                  citaDayKey: dayKey,
                  ...(dayKey ? {} : { citaMotivo: "" }),
                })
              }
              onMotiveChange={(citaMotivo) => setEditForm({ ...editForm, citaMotivo })}
              disabled={isUpdating || leadQuickAppointmentQuery.isLoading}
            />
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select
                value={pipelineSelectValueForForm(editForm.status)}
                onValueChange={(value) => setEditForm((f) => ({ ...f, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  {CRM_PIPELINE_STAGES.map((stage) => (
                    <SelectItem key={stage.key} value={stage.key}>
                      {PIPELINE_STATUS_LABELS[stage.key]}
                    </SelectItem>
                  ))}
                  <SelectItem value="perdido">{CLOSED_STATUS_LABELS.perdido}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={closeEditDialog}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateLead} disabled={!canUpdate || isUpdating}>
              {isUpdating ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailsDialog} onOpenChange={(open) => (open ? null : closeDetailsDialog())}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Detalle del lead</DialogTitle>
            <DialogDescription>
              Información y notas del lead.
            </DialogDescription>
          </DialogHeader>
          {detailsLead ? (
            <div className="flex-1 space-y-4 overflow-y-auto min-h-0 py-1 -mx-1 px-1">
              <LeadDelegationAdminBlock
                lead={detailsLead as Lead & {
                  assigned_user?: { full_name?: string | null; email?: string | null } | null;
                }}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="text-base font-medium">{detailsLead.full_name || "Sin nombre"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="text-base">{formatChilePhoneForDisplay(detailsLead.phone) || "Sin telefono"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <div className="mt-1">
                    <Badge className={cn("font-medium", getStatusMeta(detailsLead.status).styles.pill)}>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            getStatusMeta(detailsLead.status).styles.dot,
                          )}
                        />
                        {getStatusMeta(detailsLead.status).label}
                      </span>
                    </Badge>
                  </div>
                </div>
              </div>
              {detailsQuickAppointmentQuery.data?.scheduled_at ? (
                <LeadScheduleEventTag
                  scheduledAtIso={detailsQuickAppointmentQuery.data.scheduled_at}
                  description={detailsQuickAppointmentQuery.data.description}
                  footnote="Sincronizado con Citas · edita el lead para cambiar fecha o motivo"
                />
              ) : null}
              <CrmLeadContactTrackingBlock
                leadId={detailsLead.id}
                value={(detailsLead as { contact_attempts?: number }).contact_attempts ?? 0}
              />
              {(() => {
                const rut = detailsLead.rut?.trim();
                const email = detailsLead.email?.trim();
                const region = detailsLead.region?.trim() || getTagValue(detailsLead.tags, REGION_TAG_PREFIX);
                const paymentType = detailsLead.payment_type?.trim();
                const budget = detailsLead.budget?.trim();
                const pie = detailsLead.pie_disponible?.trim();
                const cuotas = detailsLead.cuotas_mensuales?.trim();
                const fields: Array<{ label: string; value: string }> = [];
                if (rut) fields.push({ label: "RUT", value: rut });
                if (email) fields.push({ label: "Correo", value: email });
                if (region) fields.push({ label: "Región", value: region });
                if (paymentType) fields.push({ label: "Financiamiento / Contado", value: paymentType });
                if (budget) fields.push({ label: "Presupuesto", value: budget });
                if (pie) fields.push({ label: "Pie", value: pie });
                if (cuotas) fields.push({ label: "Cuotas mensuales", value: cuotas });
                return fields.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {fields.map((f) => (
                      <div key={f.label}>
                        <p className="text-sm text-muted-foreground">{f.label}</p>
                        <p className="text-base">{f.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              {(() => {
                const tags = normalizeTags(detailsLead.tags);
                const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
                const makeLabel = getTagValue(tags, MARCA_TAG_PREFIX) || null;
                const modelLabel = getTagValue(tags, MODELO_TAG_PREFIX) || null;
                let vehicleLabel: string | null = null;
                if (isConsignacion) {
                  const consignacion = consignacionByLeadId.get(detailsLead.id);
                  vehicleLabel = getConsignacionVehicleLabel(consignacion)
                    || getTagValue(tags, VEHICULO_TAG_PREFIX)
                    || null;
                } else {
                  vehicleLabel = detailsLead.vehicle_interest?.trim()
                    || getTagValue(tags, VEHICULO_TAG_PREFIX)
                    || null;
                }
                const vehicleFields: Array<{ label: string; value: string }> = [];
                if (makeLabel) vehicleFields.push({ label: "Marca", value: makeLabel });
                if (modelLabel) vehicleFields.push({ label: "Modelo", value: modelLabel });
                if (vehicleLabel) vehicleFields.push({ label: "Vehículo", value: vehicleLabel });
                return vehicleFields.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {vehicleFields.map((f) => (
                      <div key={f.label}>
                        <p className="text-sm text-muted-foreground">{f.label}</p>
                        <p className="text-base">{f.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              {(detailsLead.uso_principal
                || detailsLead.pasajeros_filas
                || detailsLead.transmision
                || detailsLead.marca_preferida
                || detailsLead.anos_minimo
                || detailsLead.preferencia
                || detailsLead.alerta_crediticia
                || detailsLead.raw_message) ? (
                <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Datos del chatbot
                  </p>
                  {(() => {
                    const chatbotFields: Array<{ label: string; value: string }> = [];
                    if (detailsLead.uso_principal) chatbotFields.push({ label: "Uso principal", value: detailsLead.uso_principal });
                    if (detailsLead.transmision) chatbotFields.push({ label: "Transmisión", value: detailsLead.transmision });
                    if (detailsLead.pasajeros_filas) chatbotFields.push({ label: "Pasajeros / Filas", value: detailsLead.pasajeros_filas });
                    if (detailsLead.marca_preferida) chatbotFields.push({ label: "Marca preferida", value: detailsLead.marca_preferida });
                    if (detailsLead.anos_minimo) chatbotFields.push({ label: "Año mínimo", value: detailsLead.anos_minimo });
                    if (detailsLead.preferencia) chatbotFields.push({ label: "Preferencia", value: detailsLead.preferencia });
                    if (detailsLead.alerta_crediticia) chatbotFields.push({ label: "Alerta crediticia", value: detailsLead.alerta_crediticia });
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
                  {detailsLead.raw_message ? (
                    <div>
                      <p className="text-sm text-muted-foreground">Mensaje original</p>
                      <pre className="mt-1 whitespace-pre-wrap rounded bg-background/60 p-2 text-xs leading-relaxed">
                        {detailsLead.raw_message}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {detailsLead.notes?.trim() ? (
                <div>
                  <p className="text-sm text-muted-foreground">Nota</p>
                  <p className="text-base whitespace-pre-wrap">{detailsLead.notes}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Última modificación:{" "}
                    <span className="font-medium text-foreground/80">
                      {formatLeadTimestamp(detailsLead.updated_at) || "—"}
                    </span>
                    {" · "}
                    Creado:{" "}
                    <span className="font-medium text-foreground/80">
                      {formatLeadTimestamp(detailsLead.created_at) || "—"}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={closeDetailsDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => (open ? null : closeDeleteDialog())}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Eliminar lead</DialogTitle>
            <DialogDescription>
              El lead se moverá a la papelera (clientes que no respondieron). Podrás verlo y restaurarlo desde «Papelera».
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

      <Dialog open={showBulkDeleteDialog} onOpenChange={(open) => (open ? null : setShowBulkDeleteDialog(false))}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Eliminar leads seleccionados</DialogTitle>
            <DialogDescription>
              Los leads se moverán a la papelera (clientes que no respondieron). Podrás verlos y restaurarlos desde «Papelera».
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)} disabled={isDeletingBulk}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeletingBulk}>
              {isDeletingBulk ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </Button>
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
              Clientes eliminados por no responder. Puedes restaurarlos para que vuelvan a la lista de leads.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 py-2 -mx-1 px-1">
            {loadingPapelera ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Cargando...
              </div>
            ) : deletedLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay leads en la papelera.</p>
            ) : (
              <ul className="space-y-2">
                {deletedLeads.map((lead) => (
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
                          Eliminado {new Date(lead.deleted_at).toLocaleDateString("es-CL", { dateStyle: "medium" })}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreLead(lead.id)}
                      disabled={restoringId !== null}
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
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setShowPapeleraDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

