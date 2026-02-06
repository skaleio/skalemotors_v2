import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useConsignaciones } from "@/hooks/useConsignaciones";
import { useLeads } from "@/hooks/useLeads";
import { leadService } from "@/lib/services/leads";
import type { Database } from "@/lib/types/database";
import { useQueryClient } from "@tanstack/react-query";
import { Filter, Loader2, Mail, Pencil, Phone, Plus, Search, Target, Trash2 } from "lucide-react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

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

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");


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

const normalizeStatusKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const statusKeyByNormalized = new Map(
  Object.keys(statusLabels).map((key) => [normalizeStatusKey(key), key]),
);

const isValidStatusKey = (value: string) => statusKeyByNormalized.has(normalizeStatusKey(value));

const getNormalizedStatusKey = (value?: string | null) => {
  if (!value) return "nuevo";
  const normalized = normalizeStatusKey(value);
  return statusKeyByNormalized.get(normalized) ?? "nuevo";
};

const getStatusMeta = (value?: string | null) => {
  const normalized = getNormalizedStatusKey(value);
  return {
    label: statusLabels[normalized] || normalized,
    styles: statusStyles[normalized] || statusStyles.nuevo,
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
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => onToggleSelectAll()}
                  aria-label="Seleccionar todos los leads"
                />
              </TableHead>
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
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Cargando leads...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
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
                  <TableCell className="font-medium">{lead.full_name || "Sin nombre"}</TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{formatChilePhoneForDisplay(lead.phone) || "Sin telefono"}</span>
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
                      const normalizedStatus = getNormalizedStatusKey(lead.status);
                      const meta = getStatusMeta(normalizedStatus);
                      return (
                        <Select
                          value={normalizedStatus}
                          onValueChange={(value) => handleStatusChange(lead.id, value)}
                        >
                          <SelectTrigger
                            className="h-8 w-auto gap-2 rounded-full border px-3"
                            aria-label={`Estado ${meta.label}`}
                              onClick={(event) => event.stopPropagation()}
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
      </CardContent>
    </Card>
  );
});

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { leads, loading, refetch } = useLeads({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
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
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [formState, setFormState] = useState({
    full_name: "",
    phone: "",
    status: "nuevo",
    vehicle: "",
    region: "",
    payment_type: "",
    budget: "",
    notes: "",
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingLead, setEditingLead] = useState<(typeof leads)[number] | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);
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
    notes: "",
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
    if (user?.branch_id) {
      refetch();
    }
  }, [user?.branch_id, refetch]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "true") {
      setShowCreateDialog(true);
    }
  }, [location.search]);

  const resolvedStatusFilter = useMemo(() => {
    if (statusFilter === "all") return "all";
    return isValidStatusKey(statusFilter) ? getNormalizedStatusKey(statusFilter) : "all";
  }, [statusFilter]);

  const filteredLeads = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = !query
        || (lead.full_name || "").toLowerCase().includes(query)
        || (lead.email || "").toLowerCase().includes(query)
        || (lead.phone || "").toLowerCase().includes(query);

      const leadStatusKey = getNormalizedStatusKey(lead.status);
      const matchesStatus =
        resolvedStatusFilter === "all"
          ? true
          : leadStatusKey === resolvedStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [leads, deferredSearchQuery, resolvedStatusFilter]);

  const leadStats = useMemo(() => {
    const total = leads.length;
    const interesados = leads.filter((lead) => getNormalizedStatusKey(lead.status) === "interesado").length;
    const contactados = leads.filter((lead) => getNormalizedStatusKey(lead.status) === "contactado").length;
    const negociando = leads.filter((lead) => getNormalizedStatusKey(lead.status) === "negociando").length;
    return { total, interesados, contactados, negociando };
  }, [leads]);

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

  const handleStatusChange = useCallback(async (leadId: string, nextStatus: string) => {
    const currentLead = leads.find((item) => item.id === leadId);
    if (!currentLead || currentLead.status === nextStatus) return;

    // Optimistic update para evitar el doble intento
    queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
      if (!Array.isArray(current)) return current;
      return current.map((lead) =>
        lead.id === leadId ? { ...lead, status: nextStatus } : lead
      );
    });

    try {
      await leadService.update(leadId, { status: nextStatus as any });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (error: any) {
      console.error("Error actualizando estado del lead:", error);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      alert(error?.message || "No se pudo actualizar el estado del lead.");
    }
  }, [leads, queryClient]);

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
      notes: "",
    });
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
      const fullName = toTitleCase(rawFullName);
        const rawPhone = getRowValue(row, ["telefono", "tel", "phone", "celular"]);
        const phone = normalizePhoneWithChilePrefix(rawPhone);
        const rawVehicle = getRowValue(row, ["vehiculo", "vehículo", "auto", "modelo"]);
        const vehicle =
          rawVehicle && rawVehicle.trim().toLowerCase() !== "por definir"
            ? toTitleCase(rawVehicle.trim())
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
        const status = !responded ? "nuevo" : hasExtraInfo ? "interesado" : "contactado";

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
            branch_id: resolvedBranchId,
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

  const handleCreateLead = async () => {
    if (!user || !canSubmit) return;
    setIsCreating(true);

    try {
      const tags: string[] = [];
      if (vehicleLabel) {
        tags.push(`${VEHICULO_TAG_PREFIX}${vehicleLabel}`);
      }

      await leadService.create({
        full_name: toTitleCase(formState.full_name.trim()),
        phone: normalizePhoneWithChilePrefix(formState.phone),
        status: formState.status as any,
        source: formState.phone.trim() ? "telefono" : "otro",
        priority: "media",
        branch_id: user.branch_id,
        region: formState.region.trim() ? formState.region.trim() : null,
        payment_type: formState.payment_type ? formState.payment_type : null,
        budget: formState.budget.trim() ? formState.budget.trim() : null,
        notes: formState.notes.trim() ? formState.notes.trim() : null,
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

  const openEditDialog = useCallback((lead: Lead) => {
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
      notes: lead.notes || "",
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
        full_name: toTitleCase(editForm.full_name.trim()) || "Sin nombre",
        phone: normalizePhoneWithChilePrefix(editForm.phone) || "sin_telefono",
        email: editForm.email.trim() ? editForm.email.trim() : null,
        status: editForm.status as any,
        region: editForm.region.trim() ? editForm.region.trim() : null,
        payment_type: editForm.payment_type ? editForm.payment_type : null,
        budget: editForm.budget.trim() ? editForm.budget.trim() : null,
        notes: editForm.notes.trim() ? editForm.notes.trim() : null,
      };

      updates.tags = buildTagsWithVehicle(editingLead.tags, editForm.vehicle) as any;

      const updated = await leadService.update(editingLead.id, updates);
      queryClient.setQueriesData({ queryKey: ["leads"] }, (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.map((lead) => (lead.id === updated.id ? { ...lead, ...updated } : lead));
      });
      closeEditDialog();
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (error: any) {
      console.error("Error actualizando lead:", error);
      alert(error?.message || "No se pudo actualizar el lead.");
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

  const closeDetailsDialog = useCallback(() => {
    setShowDetailsDialog(false);
    setDetailsLead(null);
  }, []);

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
          <Button variant="outline" onClick={handleImportClick} disabled={isImporting}>
            {isImporting ? "Importando..." : "Importar leads"}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Lead
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-slate-400">
          <CardHeader className="pb-2">
            <CardDescription>Leads total</CardDescription>
            <CardTitle className="text-2xl text-slate-700">{leadStats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-indigo-500">
          <CardHeader className="pb-2">
            <CardDescription>Interesados</CardDescription>
            <CardTitle className="text-2xl text-indigo-600">{leadStats.interesados}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-blue-500">
          <CardHeader className="pb-2">
            <CardDescription>Contactados</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{leadStats.contactados}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-orange-500">
          <CardHeader className="pb-2">
            <CardDescription>Negociando</CardDescription>
            <CardTitle className="text-2xl text-orange-600">{leadStats.negociando}</CardTitle>
          </CardHeader>
        </Card>
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

      <LeadsTable
        loading={loading}
        filteredLeads={filteredLeads}
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
              <Label>Nota</Label>
              <Textarea
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                placeholder="Agrega una nota sobre el lead..."
                rows={3}
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
              <Label>Nota</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Agrega una nota sobre el lead..."
                rows={3}
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

      <Dialog open={showDetailsDialog} onOpenChange={(open) => (open ? null : closeDetailsDialog())}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Detalle del lead</DialogTitle>
            <DialogDescription>
              Información y notas del lead.
            </DialogDescription>
          </DialogHeader>
          {detailsLead ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="text-base font-medium">{detailsLead.full_name || "Sin nombre"}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="text-base">{formatChilePhoneForDisplay(detailsLead.phone) || "Sin telefono"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Correo</p>
                  <p className="text-base">{detailsLead.email || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Región</p>
                  <p className="text-base">
                    {detailsLead.region || getTagValue(detailsLead.tags, REGION_TAG_PREFIX) || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Financiamiento/Contado</p>
                  <p className="text-base">{detailsLead.payment_type || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Presupuesto</p>
                  <p className="text-base">{detailsLead.budget || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <div className="mt-1">
                    <Badge variant="secondary">{getStatusMeta(detailsLead.status).label}</Badge>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vehículo</p>
                <p className="text-base">
                  {(() => {
                    const tags = normalizeTags(detailsLead.tags);
                    const isConsignacion = tags.some((tag) => tag.startsWith(CONSIGNACION_TAG_PREFIX));
                    if (isConsignacion) {
                      const consignacion = consignacionByLeadId.get(detailsLead.id);
                      const consignacionVehicle = getConsignacionVehicleLabel(consignacion);
                      return consignacionVehicle || getTagValue(tags, VEHICULO_TAG_PREFIX) || "—";
                    }
                    return getTagValue(tags, VEHICULO_TAG_PREFIX) || "—";
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nota</p>
                <p className="text-base whitespace-pre-wrap">
                  {detailsLead.notes || "—"}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
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
