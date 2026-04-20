import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Calendar, ChevronDown, Filter, Mail, Phone, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConsignaciones } from "@/hooks/useConsignaciones";
import { useLeads } from "@/hooks/useLeads";
import { useVehicles } from "@/hooks/useVehicles";
import { consignacionesService } from "@/lib/services/consignaciones";
import { leadsAssignedToForQuery } from "@/lib/leadsScope";
import { leadService } from "@/lib/services/leads";
import type { Database } from "@/lib/types/database";
import { toSupabaseTransformedImageUrl } from "@/lib/storage-image-utils";

type Consignacion = Database["public"]["Tables"]["consignaciones"]["Row"];
type ConsignacionWithRelations = Consignacion & {
  lead?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    tags: unknown;
  } | null;
  vehicle?: {
    id: string;
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string | null;
    color: string | null;
    primary_image_url: string | null;
  } | null;
};

const CONSIGNACION_THUMB_PLACEHOLDER = "/placeholder.svg";

/** Miniatura ligera: transformación Storage + lazy load (no bloquea el hilo principal). */
const ConsignacionVehicleThumb = memo(function ConsignacionVehicleThumb({
  url,
}: {
  url: string | null | undefined;
}) {
  const src = useMemo(() => {
    if (!url?.trim()) return CONSIGNACION_THUMB_PLACEHOLDER;
    return (
      toSupabaseTransformedImageUrl(url.trim(), {
        width: 200,
        height: 140,
        quality: 68,
        resize: "cover",
      }) ?? url.trim()
    );
  }, [url]);

  return (
    <img
      src={src}
      alt=""
      className="h-14 w-[4.5rem] shrink-0 rounded-md border border-border object-cover bg-muted"
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      width={72}
      height={56}
      sizes="72px"
      onError={(e) => {
        const el = e.target as HTMLImageElement;
        const raw = url?.trim();
        if (el.dataset.fallback === "1" || !raw) {
          el.src = CONSIGNACION_THUMB_PLACEHOLDER;
          return;
        }
        el.dataset.fallback = "1";
        el.src = raw;
      }}
    />
  );
});

const statusLabels: Record<Consignacion["status"], string> = {
  nuevo: "Nuevo",
  en_revision: "En revisión",
  en_venta: "En venta",
  negociando: "Negociando",
  vendido: "Vendido",
  devuelto: "Devuelto",
};

const statusStyles: Record<Consignacion["status"], { dot: string; text: string }> = {
  nuevo: { dot: "bg-slate-400", text: "text-slate-700" },
  en_revision: { dot: "bg-blue-500", text: "text-blue-600" },
  en_venta: { dot: "bg-emerald-500", text: "text-emerald-600" },
  negociando: { dot: "bg-amber-500", text: "text-amber-600" },
  vendido: { dot: "bg-green-600", text: "text-green-700" },
  devuelto: { dot: "bg-red-500", text: "text-red-600" },
};

const labelOptions = [
  { value: "sin_etiqueta", label: "Sin etiqueta" },
  { value: "Urgente", label: "Urgente" },
  { value: "Prioritario", label: "Prioritario" },
  { value: "Documentos pendientes", label: "Documentos pendientes" },
  { value: "Listo para publicar", label: "Listo para publicar" },
  { value: "Publicado", label: "Publicado" },
  { value: "Seguimiento semanal", label: "Seguimiento semanal" },
];

const labelStyles: Record<string, { dot: string; text: string }> = {
  sin_etiqueta: { dot: "bg-slate-300", text: "text-slate-600" },
  Urgente: { dot: "bg-red-500", text: "text-red-600" },
  Prioritario: { dot: "bg-orange-500", text: "text-orange-600" },
  "Documentos pendientes": { dot: "bg-amber-500", text: "text-amber-600" },
  "Listo para publicar": { dot: "bg-emerald-500", text: "text-emerald-600" },
  Publicado: { dot: "bg-purple-500", text: "text-purple-600" },
  "Seguimiento semanal": { dot: "bg-blue-500", text: "text-blue-600" },
};

/** Encabezados alineados con la hoja «ONLINE» de STOCK ON LINE.xlsx (Miami Motors). */
const STOCK_ONLINE_COLUMN_LABELS = {
  modelo: "MODELO",
  anio: "AÑO",
  carroceria: "CARROCERÍA",
  kilometraje: "KILOMETRAJE",
  motor: "MOTOR",
  transmision: "TRANSMISION",
  combustible: "COMBUSTIBLE",
  patente: "PATENTE",
  precio: "PRECIO",
  consignatario: "CONSIGNATARIO",
  publicado: "PUBLICADO",
} as const;

const CONSIGNACION_TAG_PREFIX = "consignacion:";
const VEHICULO_TAG_PREFIX = "vehiculo:";

const normalizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return [] as string[];
  return tags.filter((tag) => typeof tag === "string") as string[];
};

const buildTagsWithLabel = (tags: unknown, label: string | null) => {
  const current = normalizeTags(tags).filter(
    (tag) => !tag.startsWith(CONSIGNACION_TAG_PREFIX)
  );
  if (!label) return current;
  return [...current, `${CONSIGNACION_TAG_PREFIX}${label}`];
};

/** Construye el texto del vehículo a partir de los datos de la consignación */
const buildVehicleLabel = (p: {
  vehicle_year?: number | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
}) => {
  const parts = [p.vehicle_year, p.vehicle_make, p.vehicle_model].filter(Boolean);
  return parts.length ? parts.join(" ").trim() : "";
};

/**
 * Tags para el lead cuando proviene de una consignación:
 * - Siempre incluye etiqueta consignación (para que Origen = "Consignación" en Leads)
 * - Incluye vehiculo: si hay datos del vehículo
 */
const buildLeadTagsForConsignacion = (
  tags: unknown,
  consignacionLabel: string | null,
  vehicleLabel: string
) => {
  const current = normalizeTags(tags).filter(
    (tag) => !tag.startsWith(CONSIGNACION_TAG_PREFIX) && !tag.startsWith(VEHICULO_TAG_PREFIX)
  );
  const withConsignacion = [
    ...current,
    `${CONSIGNACION_TAG_PREFIX}${consignacionLabel || "sin_etiqueta"}`,
  ];
  if (vehicleLabel.trim()) {
    withConsignacion.push(`${VEHICULO_TAG_PREFIX}${vehicleLabel.trim()}`);
  }
  return withConsignacion;
};

const removeConsignacionTags = (tags: unknown) => {
  return normalizeTags(tags).filter((tag) => !tag.startsWith(CONSIGNACION_TAG_PREFIX));
};

const normalizeLabelValue = (label: string) => {
  if (!label || label === "sin_etiqueta") return "sin_etiqueta";
  return label;
};

const toLeadTagLabel = (label: string) => {
  if (!label || label === "sin_etiqueta") return null;
  return label;
};

const getLabelMeta = (value: string) => {
  const normalized = normalizeLabelValue(value);
  const option = labelOptions.find((item) => item.value === normalized);
  return {
    label: option?.label || normalized,
    styles: labelStyles[normalized] || labelStyles.sin_etiqueta,
  };
};

const getStatusMeta = (value: Consignacion["status"]) => {
  return {
    label: statusLabels[value] || value,
    styles: statusStyles[value],
  };
};

const getLabelBorderColor = (label: string | null): string => {
  const normalized = normalizeLabelValue(label || "sin_etiqueta");
  const dotClass = labelStyles[normalized]?.dot || labelStyles.sin_etiqueta.dot;

  // Mapear clases de Tailwind a colores hex
  if (dotClass.includes('red-500')) return '#ef4444';
  if (dotClass.includes('blue-500')) return '#3b82f6';
  if (dotClass.includes('purple-500')) return '#a855f7';
  if (dotClass.includes('emerald-500') || dotClass.includes('green')) return '#10b981';
  if (dotClass.includes('orange-500')) return '#f97316';
  if (dotClass.includes('amber-500')) return '#f59e0b';
  return '#94a3b8'; // slate por defecto
};

const normalizeStatusValue = (value: string) => {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const formatMeetingDisplay = (value: string | null) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-CL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDatetimeLocal = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - tzOffset);
  return localDate.toISOString().slice(0, 16);
};

const parseCurrencyInput = (value: string) => {
  // Remover puntos (separadores de miles) y otros caracteres no numéricos
  const cleaned = value.replace(/\./g, "").replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatCLP = (value: number | null) => {
  if (!value || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumberCLP = (value: number | null) => {
  if (!value || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
};

const toNumberString = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "";
  return String(Math.round(value));
};

const PriceInput = ({
  value,
  onBlur,
  className,
}: {
  value: number | null;
  onBlur: (value: string) => void;
  className?: string;
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(toNumberString(value));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setDisplayValue("");
    onBlur(e.target.value);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir solo números
    const cleaned = e.target.value.replace(/[^\d]/g, "");
    setDisplayValue(cleaned);
  };

  return (
    <Input
      type="text"
      value={isFocused ? displayValue : formatNumberCLP(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className={className}
      placeholder="—"
    />
  );
};

const MeetingDateInput = ({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState("");

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(toDatetimeLocal(value));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setDisplayValue("");
    if (e.target.value) {
      onChange(e.target.value);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayValue(e.target.value);
  };

  if (isFocused) {
    return (
      <Input
        type="datetime-local"
        value={displayValue}
        onBlur={handleBlur}
        onChange={handleChange}
        className={className}
        autoFocus
      />
    );
  }

  return (
    <Input
      type="text"
      value={formatMeetingDisplay(value)}
      onFocus={handleFocus}
      className={className}
      placeholder="Sin fecha"
      readOnly
    />
  );
};

type VehicleFuel = Database["public"]["Tables"]["vehicles"]["Row"]["fuel_type"];
type VehicleTransmission = Database["public"]["Tables"]["vehicles"]["Row"]["transmission"];

const fuelTypeToDisplay = (v: VehicleFuel) => {
  if (!v) return "";
  const map: Record<string, string> = {
    gasolina: "Gasolina",
    diesel: "Diésel",
    híbrido: "Híbrido",
    eléctrico: "Eléctrico",
  };
  return map[v] ?? v;
};

const transmissionToDisplay = (v: VehicleTransmission) => {
  if (!v) return "";
  const map: Record<string, string> = {
    manual: "Manual",
    automático: "Automático",
    cvt: "CVT",
  };
  return map[v] ?? v;
};

const getConsignacionModel = (item: ConsignacionWithRelations) =>
  item.vehicle?.model ?? item.vehicle_model ?? "";

const getConsignacionYear = (item: ConsignacionWithRelations) =>
  item.vehicle?.year ?? item.vehicle_year ?? null;

const getConsignacionKm = (item: ConsignacionWithRelations) => item.vehicle_km ?? null;

const ConsignacionTextCell = ({
  value,
  onSave,
  className,
  placeholder = "—",
}: {
  value: string | null;
  onSave: (next: string | null) => void | Promise<void>;
  className?: string;
  placeholder?: string;
}) => {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        const prev = (value ?? "").trim();
        const nextVal = trimmed === "" ? null : trimmed;
        const prevVal = prev === "" ? null : prev;
        if (nextVal !== prevVal) void onSave(nextVal);
      }}
      className={className}
      placeholder={placeholder}
    />
  );
};

const ConsignacionYearCell = ({
  value,
  onSave,
  className,
}: {
  value: number | null;
  onSave: (next: number | null) => void | Promise<void>;
  className?: string;
}) => {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  useEffect(() => setDraft(value != null ? String(value) : ""), [value]);
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
      onBlur={() => {
        if (!draft.trim()) {
          if (value !== null) void onSave(null);
          return;
        }
        const n = Number(draft);
        if (!Number.isFinite(n) || n < 1900 || n > 2100) {
          setDraft(value != null ? String(value) : "");
          return;
        }
        if (n !== value) void onSave(n);
      }}
      className={className}
      placeholder="—"
    />
  );
};

const ConsignacionKmCell = ({
  value,
  onSave,
  className,
}: {
  value: number | null;
  onSave: (next: number | null) => void | Promise<void>;
  className?: string;
}) => {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  useEffect(() => setDraft(value != null ? String(value) : ""), [value]);
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
      onBlur={() => {
        if (!draft.trim()) {
          if (value !== null) void onSave(null);
          return;
        }
        const n = Number(draft);
        if (!Number.isFinite(n) || n < 0) {
          setDraft(value != null ? String(value) : "");
          return;
        }
        const rounded = Math.round(n);
        if (rounded !== value) void onSave(rounded);
      }}
      className={className}
      placeholder="—"
    />
  );
};

export default function Consignaciones() {
  const { user } = useAuth();
  const isVendedor = user?.role === "vendedor";
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [consignacionAdvancedOpen, setConsignacionAdvancedOpen] = useState(false);

  // Sin filtrar por sucursal al cargar: mostrar todas las consignaciones
  const { consignaciones, loading, error: consignacionesError, refetch, setConsignaciones } = useConsignaciones({
    branchId: undefined,
    search: searchQuery || undefined,
    enabled: !!user,
  });

  const { leads } = useLeads({
    branchId: user?.branch_id ?? undefined,
    assignedTo: leadsAssignedToForQuery(user?.role, user?.id),
    enabled: !!user,
  });

  const { vehicles } = useVehicles({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });

  const [formState, setFormState] = useState({
    owner_name: "",
    owner_phone: "",
    owner_email: "",
    lead_id: "",
    vehicle_id: "",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_vin: "",
    vehicle_km: "",
    carroceria: "",
    motor: "",
    transmision: "",
    combustible: "",
    patente: "",
    label: "sin_etiqueta",
    status: "nuevo" as Consignacion["status"],
    notes: "",
    meeting_at: "",
    fecha: "",
    consignacion_price: "",
    sale_price: "",
    publicado: false,
  });

  const applyAppraisalPrefill = () => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") !== "true" || params.get("source") !== "appraisal") return;

    const make = params.get("make") ?? "";
    const model = params.get("model") ?? "";
    const year = params.get("year") ?? "";
    const patente = params.get("patente") ?? "";

    setFormState((prev) => ({
      ...prev,
      vehicle_make: make || prev.vehicle_make,
      vehicle_model: model || prev.vehicle_model,
      vehicle_year: year || prev.vehicle_year,
      patente: patente || prev.patente,
      notes:
        !prev.notes && patente
          ? `Patente tasada: ${patente}`
          : prev.notes,
    }));
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "true") {
      setShowCreateDialog(true);
      applyAppraisalPrefill();
    }
  }, [location.search]);

  useEffect(() => {
    const handleOpenNewConsignacionForm = () => setShowCreateDialog(true);
    window.addEventListener("openNewConsignacionForm", handleOpenNewConsignacionForm);
    return () => window.removeEventListener("openNewConsignacionForm", handleOpenNewConsignacionForm);
  }, []);

  const filteredConsignaciones = useMemo(() => {
    let filtered = (consignaciones as ConsignacionWithRelations[]).map((item) => item);

    if (statusFilter !== "all") {
      const normalizedFilter = normalizeStatusValue(statusFilter);
      filtered = filtered.filter(
        (item) => normalizeStatusValue(String(item.status)) === normalizedFilter
      );
    }

    if (labelFilter !== "all") {
      filtered = filtered.filter((item) => {
        const itemLabel = normalizeLabelValue(item.label || "sin_etiqueta");
        return itemLabel === labelFilter;
      });
    }

    return filtered;
  }, [consignaciones, labelFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = filteredConsignaciones.length;
    const totalConsignacionValue = filteredConsignaciones.reduce(
      (sum, item) => sum + (item.consignacion_price ?? 0),
      0
    );
    const totalSaleValue = filteredConsignaciones.reduce(
      (sum, item) => sum + (item.sale_price ?? 0),
      0
    );
    const totalMargin = totalSaleValue - totalConsignacionValue;
    const enVenta = filteredConsignaciones.filter((item) => item.status === "en_venta").length;

    return {
      total,
      totalConsignacionValue,
      totalSaleValue,
      totalMargin,
      enVenta,
    };
  }, [filteredConsignaciones]);

  const isFilterActive = statusFilter !== "all" || labelFilter !== "all" || searchQuery.trim() !== "";

  const handleLeadChange = (leadId: string) => {
    if (!leadId) {
      setFormState((prev) => ({ ...prev, lead_id: "" }));
      return;
    }
    const lead = leads.find((l) => l.id === leadId);
    setFormState((prev) => ({
      ...prev,
      lead_id: leadId,
      owner_name: prev.owner_name || lead?.full_name || "",
      owner_phone: prev.owner_phone || lead?.phone || "",
      owner_email: prev.owner_email || lead?.email || "",
    }));
  };

  const handleVehicleChange = (vehicleId: string) => {
    if (!vehicleId) {
      setFormState((prev) => ({ ...prev, vehicle_id: "" }));
      return;
    }
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    setFormState((prev) => ({
      ...prev,
      vehicle_id: vehicleId,
      vehicle_make: prev.vehicle_make || vehicle?.make || "",
      vehicle_model: prev.vehicle_model || vehicle?.model || "",
      vehicle_year: prev.vehicle_year || (vehicle?.year ? `${vehicle.year}` : ""),
      vehicle_vin: prev.vehicle_vin || vehicle?.vin || "",
      patente: prev.patente || vehicle?.patente || "",
      vehicle_km:
        prev.vehicle_km || (vehicle?.mileage != null ? String(vehicle.mileage) : ""),
      motor: prev.motor || vehicle?.engine_size || "",
      transmision: prev.transmision || transmissionToDisplay(vehicle?.transmission ?? null) || "",
      combustible: prev.combustible || fuelTypeToDisplay(vehicle?.fuel_type ?? null) || "",
    }));
  };

  const resetForm = () => {
    setFormState({
      owner_name: "",
      owner_phone: "",
      owner_email: "",
      lead_id: "",
      vehicle_id: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_year: "",
      vehicle_vin: "",
      vehicle_km: "",
      carroceria: "",
      motor: "",
      transmision: "",
      combustible: "",
      patente: "",
      label: "sin_etiqueta",
      status: "nuevo",
      notes: "",
      meeting_at: "",
      fecha: "",
      consignacion_price: "",
      sale_price: "",
      publicado: false,
    });
  };

  const handleCreate = async () => {
    if (!user?.id) {
      setCreateError("No hay sesión activa. Inicia sesión para continuar.");
      return;
    }

    setCreateError(null);
    setIsCreating(true);
    try {
      const ownerName = formState.owner_name.trim() || "Sin nombre";
      const payloadBase = {
        owner_name: ownerName,
        owner_phone: formState.owner_phone.trim() || null,
        owner_email: formState.owner_email.trim() || null,
        lead_id: formState.lead_id || null,
        vehicle_id: formState.vehicle_id || null,
        vehicle_make: formState.vehicle_make.trim() || null,
        vehicle_model: formState.vehicle_model.trim() || null,
        vehicle_year: (() => {
          const raw = formState.vehicle_year ? Number(formState.vehicle_year) : null;
          if (raw == null || !Number.isFinite(raw) || raw < 1900 || raw > 2100) return null;
          return raw;
        })(),
        vehicle_vin: formState.vehicle_vin.trim() || null,
        vehicle_km: (() => {
          const raw = formState.vehicle_km ? Number(formState.vehicle_km) : null;
          if (raw == null || !Number.isFinite(raw) || raw < 0) return null;
          return Math.round(raw);
        })(),
        carroceria: formState.carroceria.trim() || null,
        motor: formState.motor.trim() || null,
        transmision: formState.transmision.trim() || null,
        combustible: formState.combustible.trim() || null,
        patente: formState.patente.trim() ? formState.patente.trim() : null,
        publicado: formState.publicado,
        label: normalizeLabelValue(formState.label),
        status: formState.status,
        notes: formState.notes.trim() || null,
        meeting_at: formState.meeting_at
          ? new Date(formState.meeting_at).toISOString()
          : null,
        fecha: formState.fecha && formState.fecha.trim() ? formState.fecha.trim() : null,
        consignacion_price: parseCurrencyInput(formState.consignacion_price),
        sale_price: parseCurrencyInput(formState.sale_price),
        branch_id: user.branch_id ?? null,
        created_by: user.id,
      } satisfies Database["public"]["Tables"]["consignaciones"]["Insert"];

      const leadLabel = toLeadTagLabel(payloadBase.label);
      const hasContact = Boolean(payloadBase.owner_phone || payloadBase.owner_email);
      const vehicleLabel = buildVehicleLabel(payloadBase);
      const leadTagsFromConsignacion = buildLeadTagsForConsignacion(
        [],
        leadLabel || "sin_etiqueta",
        vehicleLabel
      );

      const payload = {
        ...payloadBase,
        lead_id: payloadBase.lead_id || null,
      } satisfies Database["public"]["Tables"]["consignaciones"]["Insert"];

      const created = await consignacionesService.create(payload);

      // Mostrar de inmediato en la lista para evitar bloqueos
      setConsignaciones((prev) => [created, ...prev]);

      // Sincronizar lead en segundo plano: origen Consignación y vehículo
      if (hasContact || payloadBase.lead_id) {
        (async () => {
          try {
            let resolvedLeadId = payloadBase.lead_id || null;

            if (!resolvedLeadId && hasContact) {
              const existingLead = await leadService.findByContact({
                branchId: user?.branch_id ?? undefined,
                phone: payloadBase.owner_phone,
                email: payloadBase.owner_email,
              });

              if (existingLead) {
                const nextTags = buildLeadTagsForConsignacion(
                  existingLead.tags,
                  leadLabel || "sin_etiqueta",
                  vehicleLabel
                );
                await leadService.update(existingLead.id, { tags: nextTags as any });
                resolvedLeadId = existingLead.id;
              } else {
                const createdLead = await leadService.create({
                  full_name: payloadBase.owner_name || "Sin nombre",
                  phone: payloadBase.owner_phone || "sin_telefono",
                  email: payloadBase.owner_email,
                  source: payloadBase.owner_phone ? "telefono" : "otro",
                  status: "nuevo",
                  priority: "media",
                  tenant_id: user?.tenant_id ?? null,
                  branch_id: user?.branch_id ?? null,
                  assigned_to: user?.role === "vendedor" ? user.id : null,
                  tags: leadTagsFromConsignacion as any,
                });
                resolvedLeadId = createdLead.id;
              }
            } else if (resolvedLeadId) {
              const lead = leads.find((l) => l.id === resolvedLeadId) || (await leadService.getById(resolvedLeadId));
              const nextTags = buildLeadTagsForConsignacion(
                lead?.tags ?? [],
                leadLabel || "sin_etiqueta",
                vehicleLabel
              );
              await leadService.update(resolvedLeadId, { tags: nextTags as any });
            }

            if (resolvedLeadId) {
              await consignacionesService.update(created.id, { lead_id: resolvedLeadId });
            }
          } catch (error) {
            console.error("Error sincronizando lead de consignacion:", error);
          }
        })();
      }

      // Refrescar la lista sin bloquear el guardado
      refetch().catch((error) => {
        console.error("Error al refrescar consignaciones:", error);
      });

      resetForm();
      setShowCreateDialog(false);
    } catch (error: any) {
      console.error("Error creando consignacion:", error);
      const message = error?.message || error?.error_description || "No se pudo crear la consignación.";
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLabelChange = async (item: ConsignacionWithRelations, label: string) => {
    const nextLabel = normalizeLabelValue(label);
    const prevLabel = normalizeLabelValue(item.label || "sin_etiqueta");
    if (nextLabel === prevLabel) return;

    // Optimistic update
    setConsignaciones((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, label: nextLabel } : row))
    );

    try {
      const updated = await consignacionesService.update(item.id, { label: nextLabel });
      // Actualizar estado con la respuesta del servidor
      setConsignaciones((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row))
      );

      // Actualizar tags del lead si existe (en segundo plano)
      if (item.lead_id) {
        const lead = leads.find((l) => l.id === item.lead_id);
        const nextTags = buildTagsWithLabel(lead?.tags, toLeadTagLabel(nextLabel));
        leadService.update(item.lead_id, { tags: nextTags as any }).catch((err) =>
          console.error("Error actualizando tags del lead:", err)
        );
      }

      refetch().catch(() => {});
    } catch (error: any) {
      console.error("Error actualizando etiqueta:", error);
      setConsignaciones((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, label: prevLabel } : row))
      );
      refetch().catch(() => {});
      alert(error?.message || "No se pudo actualizar la etiqueta.");
    }
  };

  const handleStatusChange = async (item: ConsignacionWithRelations, status: Consignacion["status"]) => {
    // Optimistic update
    setConsignaciones((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, status } : row))
    );

    try {
      await consignacionesService.update(item.id, { status });
      // Refrescar desde Supabase para asegurar sincronización
      await refetch();
    } catch (error: any) {
      console.error("Error actualizando estado:", error);
      // Revertir cambio optimista
      await refetch();
      alert(error?.message || "No se pudo actualizar el estado.");
    }
  };

  const handleMeetingChange = async (item: ConsignacionWithRelations, value: string) => {
    const meeting_at = value ? new Date(value).toISOString() : null;

    // Optimistic update
    setConsignaciones((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, meeting_at } : row))
    );

    try {
      await consignacionesService.update(item.id, { meeting_at });
      // Refrescar desde Supabase para asegurar sincronización
      await refetch();
    } catch (error: any) {
      console.error("Error actualizando reunion:", error);
      // Revertir cambio optimista
      await refetch();
      alert(error?.message || "No se pudo actualizar la reunion.");
    }
  };

  const handlePriceChange = async (
    item: ConsignacionWithRelations,
    field: "consignacion_price" | "sale_price",
    value: string
  ) => {
    const parsed = parseCurrencyInput(value);
    const current = item[field] ?? null;
    if (parsed === current) return;

    // Optimistic update
    setConsignaciones((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, [field]: parsed } : row))
    );

    try {
      await consignacionesService.update(item.id, { [field]: parsed } as any);
      // Refrescar desde Supabase para asegurar sincronización
      await refetch();
    } catch (error: any) {
      console.error("Error actualizando precio:", error);
      // Revertir cambio optimista
      await refetch();
      alert(error?.message || "No se pudo actualizar el precio.");
    }
  };

  const patchConsignacionRow = async (
    item: ConsignacionWithRelations,
    updates: Database["public"]["Tables"]["consignaciones"]["Update"],
  ) => {
    setConsignaciones((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, ...updates } : row)),
    );
    try {
      const updated = await consignacionesService.update(item.id, updates);
      setConsignaciones((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)),
      );
      await refetch();
    } catch (error: any) {
      console.error("Error actualizando consignación:", error);
      await refetch();
      alert(error?.message || "No se pudo guardar el cambio.");
    }
  };

  const handlePublicadoChange = async (item: ConsignacionWithRelations, publicado: boolean) => {
    if (publicado === item.publicado) return;
    await patchConsignacionRow(item, { publicado });
  };

  const handleDelete = async (item: ConsignacionWithRelations) => {
    if (!confirm(`¿Eliminar la consignacion de ${item.owner_name}?`)) return;

    // Optimistic update
    const previousConsignaciones = [...consignaciones];
    setConsignaciones((prev) => prev.filter((row) => row.id !== item.id));

    try {
      await consignacionesService.remove(item.id);

      if (item.lead_id) {
        const lead = leads.find((l) => l.id === item.lead_id) || (await leadService.getById(item.lead_id));
        const nextTags = removeConsignacionTags(lead?.tags);
        await leadService.update(item.lead_id, { tags: nextTags as any });
      }

      // Refrescar desde Supabase para asegurar sincronización
      await refetch();
    } catch (error: any) {
      console.error("Error eliminando consignacion:", error);
      // Revertir cambio optimista
      setConsignaciones(previousConsignaciones);
      alert(error?.message || "No se pudo eliminar la consignacion.");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Consignaciones</h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Controla clientes y autos consignados, y gestiona etiquetas de leads. El listado se mantiene y no se resetea al cambiar de mes.
          </p>
        </div>
        {!isVendedor && (
          <Button onClick={() => setShowCreateDialog(true)} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nueva consignacion
          </Button>
        )}
      </div>

      {!isVendedor && (
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 md:pb-3">
              <CardTitle className="text-xs md:text-base">Total Consignaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {isFilterActive ? (
                  <>de {consignaciones.length} registradas (filtrado)</>
                ) : (
                  <>registradas</>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 md:pb-3">
              <CardTitle className="text-xs md:text-base">Valor Consignación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCLP(stats.totalConsignacionValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                precio de consignación
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 md:pb-3">
              <CardTitle className="text-xs md:text-base">Valor Venta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCLP(stats.totalSaleValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                precio de venta total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 md:pb-3">
              <CardTitle className="text-xs md:text-base">Margen Proyectado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-green-600">{formatCLP(stats.totalMargin)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                margen estimado
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex-1 relative">
              <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={isMobile ? "Buscar..." : "Buscar por cliente, telefono, email o vehiculo..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4 md:items-end">
              <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                <div className="w-full sm:w-auto min-w-[180px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Estado</Label>
                  <div className="flex items-center gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className={`w-full min-w-[180px] md:w-[200px] ${statusFilter !== "all" ? "border-blue-500 bg-blue-50" : ""}`}>
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
                    {statusFilter !== "all" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        onClick={() => setStatusFilter("all")}
                        title="Limpiar filtro de estado"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-auto min-w-[180px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Etiqueta</Label>
                  <div className="flex items-center gap-2">
                    <Select value={labelFilter} onValueChange={setLabelFilter}>
                      <SelectTrigger className={`w-full min-w-[180px] md:w-[200px] ${labelFilter !== "all" ? "border-blue-500 bg-blue-50" : ""}`}>
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filtrar por etiqueta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las etiquetas</SelectItem>
                        {labelOptions.map((option) => {
                          const optionMeta = getLabelMeta(option.value);
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${optionMeta.styles.dot}`} />
                                <span className={optionMeta.styles.text}>{optionMeta.label}</span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {labelFilter !== "all" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        onClick={() => setLabelFilter("all")}
                        title="Limpiar filtro de etiqueta"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {isFilterActive && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("all");
                    setLabelFilter("all");
                    setSearchQuery("");
                  }}
                  className="h-10 w-full md:w-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
          {isFilterActive && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando <strong>{filteredConsignaciones.length}</strong> de <strong>{consignaciones.length}</strong> consignaciones
                {statusFilter !== "all" && (
                  <span> • Estado: <strong>{statusLabels[statusFilter as Consignacion["status"]]}</strong></span>
                )}
                {labelFilter !== "all" && (
                  <span> • Etiqueta: <strong>{getLabelMeta(labelFilter).label}</strong></span>
                )}
                {searchQuery && (
                  <span> • Búsqueda: <strong>"{searchQuery}"</strong></span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {consignacionesError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  Error al cargar consignaciones
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {consignacionesError.message || "Error desconocido"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de consignaciones</CardTitle>
          <CardDescription>
            {filteredConsignaciones.length} registro
            {filteredConsignaciones.length !== 1 ? "s" : ""} encontrado
            {filteredConsignaciones.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando consignaciones...
            </div>
          ) : filteredConsignaciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay consignaciones registradas
            </div>
          ) : isMobile ? (
            // Vista móvil: Cards
            <div className="space-y-3">
              {filteredConsignaciones.map((item) => {
                const vehicleVin = item.vehicle?.vin || item.vehicle_vin;
                const labelMeta = getLabelMeta(item.label || "sin_etiqueta");
                const statusMeta = getStatusMeta(item.status);
                const model = getConsignacionModel(item);
                const year = getConsignacionYear(item);

                return (
                  <Card key={item.id} className="border-l-4" style={{ borderLeftColor: getLabelBorderColor(item.label) }}>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex gap-3 min-w-0 flex-1">
                            <ConsignacionVehicleThumb url={item.vehicle?.primary_image_url} />
                            <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base truncate">
                              {item.patente?.trim() || model || item.vehicle_make || "Consignación"}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Select
                                value={item.label || "sin_etiqueta"}
                                onValueChange={(value) => handleLabelChange(item, value)}
                              >
                                <SelectTrigger className="h-7 w-auto gap-1.5 rounded-full border px-2.5 text-xs" aria-label={`Etiqueta ${labelMeta.label}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${labelMeta.styles.dot}`} />
                                  <span className={`text-xs font-medium ${labelMeta.styles.text}`}>
                                    {labelMeta.label}
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  {labelOptions.map((option) => {
                                    const optionMeta = getLabelMeta(option.value);
                                    return (
                                      <SelectItem key={option.value} value={option.value}>
                                        <span className="flex items-center gap-2">
                                          <span className={`h-2.5 w-2.5 rounded-full ${optionMeta.styles.dot}`} />
                                          <span className={optionMeta.styles.text}>{optionMeta.label}</span>
                                        </span>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <Select
                                value={item.status}
                                onValueChange={(value) => handleStatusChange(item, value as Consignacion["status"])}
                              >
                                <SelectTrigger className="h-7 w-auto gap-1.5 rounded-full border px-2.5 text-xs" aria-label={`Estado ${statusMeta.label}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.styles.dot}`} />
                                  <span className={`text-xs font-medium ${statusMeta.styles.text}`}>{statusMeta.label}</span>
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(statusLabels).map(([key, label]) => {
                                    const styles = statusStyles[key as Consignacion["status"]];
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
                            </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            title="Eliminar consignacion"
                            className="h-8 w-8 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>

                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                          <div className="col-span-2">
                            <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.modelo}</dt>
                            <dd className="font-medium truncate">
                              {model || item.vehicle_make || "—"}
                              {year != null ? ` · ${year}` : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.carroceria}</dt>
                            <dd className="truncate">{item.carroceria || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.kilometraje}</dt>
                            <dd>{getConsignacionKm(item) != null ? `${getConsignacionKm(item)?.toLocaleString("es-CL")}` : "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.motor}</dt>
                            <dd className="truncate">{item.motor || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.transmision}</dt>
                            <dd className="truncate">{item.transmision || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.combustible}</dt>
                            <dd className="truncate">{item.combustible || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.patente}</dt>
                            <dd className="truncate">{item.patente || "—"}</dd>
                          </div>
                          {!isVendedor && (
                            <div>
                              <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.precio}</dt>
                              <dd>
                                <PriceInput
                                  value={item.consignacion_price ?? null}
                                  onBlur={(value) => handlePriceChange(item, "consignacion_price", value)}
                                  className="w-full text-sm"
                                />
                              </dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.consignatario}</dt>
                            <dd className="font-medium truncate">{item.owner_name}</dd>
                          </div>
                          <div className="col-span-2 flex items-center justify-between gap-3 pt-1 border-t border-border/60 mt-1">
                            <div>
                              <dt className="text-xs text-muted-foreground">{STOCK_ONLINE_COLUMN_LABELS.publicado}</dt>
                              <dd className="pt-1">
                                <Switch
                                  checked={item.publicado}
                                  onCheckedChange={(v) => handlePublicadoChange(item, v)}
                                  aria-label={STOCK_ONLINE_COLUMN_LABELS.publicado}
                                />
                              </dd>
                            </div>
                          </div>
                        </dl>

                        {vehicleVin ? (
                          <div className="text-xs text-muted-foreground">VIN: {vehicleVin}</div>
                        ) : null}

                        <div className="space-y-1.5">
                          {item.owner_phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <span>{item.owner_phone}</span>
                            </div>
                          )}
                          {item.owner_email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span className="truncate">{item.owner_email}</span>
                            </div>
                          )}
                        </div>

                        <div className={`grid gap-3 pt-2 border-t ${isVendedor ? "grid-cols-1" : "grid-cols-2"}`}>
                          {!isVendedor && (
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Precio venta</Label>
                              <PriceInput
                                value={item.sale_price ?? null}
                                onBlur={(value) => handlePriceChange(item, "sale_price", value)}
                                className="w-full text-sm"
                              />
                            </div>
                          )}
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              Reunión
                            </Label>
                            <MeetingDateInput
                              value={item.meeting_at}
                              onChange={(value) => handleMeetingChange(item, value)}
                              className="w-full text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            Fecha de subida
                          </Label>
                          {item.fecha ? (
                            <span className="text-sm text-muted-foreground">
                              {new Date(item.fecha).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[4.5rem] p-2 text-center text-xs font-semibold uppercase tracking-wide">
                    Foto
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">{STOCK_ONLINE_COLUMN_LABELS.modelo}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide w-[5rem]">{STOCK_ONLINE_COLUMN_LABELS.anio}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[7rem]">{STOCK_ONLINE_COLUMN_LABELS.carroceria}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[6.5rem]">{STOCK_ONLINE_COLUMN_LABELS.kilometraje}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[6rem]">{STOCK_ONLINE_COLUMN_LABELS.motor}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[6rem]">{STOCK_ONLINE_COLUMN_LABELS.transmision}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[6rem]">{STOCK_ONLINE_COLUMN_LABELS.combustible}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[5.5rem]">{STOCK_ONLINE_COLUMN_LABELS.patente}</TableHead>
                  {!isVendedor && (
                    <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[7rem]">{STOCK_ONLINE_COLUMN_LABELS.precio}</TableHead>
                  )}
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[7rem]">{STOCK_ONLINE_COLUMN_LABELS.consignatario}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-center w-[5.5rem]">{STOCK_ONLINE_COLUMN_LABELS.publicado}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">Estado CRM</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">Etiqueta</TableHead>
                  <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide min-w-[7rem]">Reunión</TableHead>
                  {!isVendedor && (
                    <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide">P. venta</TableHead>
                  )}
                  {!isVendedor && (
                    <TableHead className="text-right whitespace-nowrap text-xs font-semibold uppercase tracking-wide">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConsignaciones.map((item) => {
                  const vehicleVin = item.vehicle?.vin || item.vehicle_vin;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="p-2 align-middle w-[4.5rem]">
                        <div className="flex justify-center">
                          <ConsignacionVehicleThumb url={item.vehicle?.primary_image_url} />
                        </div>
                      </TableCell>
                      <TableCell className="p-2 align-top min-w-[8rem]">
                        <ConsignacionTextCell
                          value={getConsignacionModel(item) || null}
                          onSave={(next) => patchConsignacionRow(item, { vehicle_model: next })}
                          className="h-8 text-xs"
                        />
                        {vehicleVin ? (
                          <div className="text-[10px] text-muted-foreground mt-0.5">VIN {vehicleVin}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        <ConsignacionYearCell
                          value={getConsignacionYear(item)}
                          onSave={(next) => patchConsignacionRow(item, { vehicle_year: next })}
                          className="h-8 text-xs w-[4.5rem]"
                        />
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        <ConsignacionTextCell
                          value={item.carroceria}
                          onSave={(next) => patchConsignacionRow(item, { carroceria: next })}
                          className="h-8 text-xs min-w-[6rem]"
                        />
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        <ConsignacionKmCell
                          value={getConsignacionKm(item)}
                          onSave={(next) => patchConsignacionRow(item, { vehicle_km: next })}
                          className="h-8 text-xs min-w-[5.5rem]"
                        />
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        <ConsignacionTextCell
                          value={item.motor}
                          onSave={(next) => patchConsignacionRow(item, { motor: next })}
                          className="h-8 text-xs min-w-[5rem]"
                        />
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        <ConsignacionTextCell
                          value={item.transmision}
                          onSave={(next) => patchConsignacionRow(item, { transmision: next })}
                          className="h-8 text-xs min-w-[5rem]"
                        />
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        <ConsignacionTextCell
                          value={item.combustible}
                          onSave={(next) => patchConsignacionRow(item, { combustible: next })}
                          className="h-8 text-xs min-w-[5rem]"
                        />
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        <ConsignacionTextCell
                          value={item.patente}
                          onSave={(next) => patchConsignacionRow(item, { patente: next && next.trim() ? next.trim() : null })}
                          className="h-8 text-xs min-w-[4.5rem]"
                        />
                      </TableCell>
                      {!isVendedor && (
                        <TableCell className="p-2 align-top">
                          <PriceInput
                            value={item.consignacion_price ?? null}
                            onBlur={(value) => handlePriceChange(item, "consignacion_price", value)}
                            className="h-8 text-xs w-[120px]"
                          />
                        </TableCell>
                      )}
                      <TableCell className="p-2 align-top min-w-[7rem]">
                        <ConsignacionTextCell
                          value={item.owner_name}
                          onSave={(next) =>
                            patchConsignacionRow(item, { owner_name: (next && next.trim()) || "Sin nombre" })
                          }
                          className="h-8 text-xs"
                        />
                        <div className="text-[10px] text-muted-foreground space-y-0.5 mt-0.5">
                          {item.owner_phone ? <div>{item.owner_phone}</div> : null}
                          {item.owner_email ? <div className="truncate max-w-[10rem]">{item.owner_email}</div> : null}
                        </div>
                      </TableCell>
                      <TableCell className="p-2 align-top text-center">
                        <Switch
                          checked={item.publicado}
                          onCheckedChange={(v) => handlePublicadoChange(item, v)}
                          aria-label="Publicado"
                        />
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        {(() => {
                          const meta = getStatusMeta(item.status);
                          return (
                            <Select
                              value={item.status}
                              onValueChange={(value) => handleStatusChange(item, value as Consignacion["status"])}
                            >
                              <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border px-2.5" aria-label={`Estado ${meta.label}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${meta.styles.dot}`} />
                                <span className={`text-xs font-medium ${meta.styles.text}`}>{meta.label}</span>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusLabels).map(([key, label]) => {
                                  const styles = statusStyles[key as Consignacion["status"]];
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
                      <TableCell className="p-2 align-top">
                        {(() => {
                          const meta = getLabelMeta(item.label || "sin_etiqueta");
                          return (
                            <Select
                              value={item.label || "sin_etiqueta"}
                              onValueChange={(value) => handleLabelChange(item, value)}
                            >
                              <SelectTrigger className="h-8 w-auto gap-1.5 rounded-full border px-2.5" aria-label={`Etiqueta ${meta.label}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${meta.styles.dot}`} />
                                <span className={`text-xs font-medium ${meta.styles.text}`}>
                                  {meta.label}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {labelOptions.map((option) => {
                                  const optionMeta = getLabelMeta(option.value);
                                  return (
                                    <SelectItem key={option.value} value={option.value}>
                                      <span className="flex items-center gap-2">
                                        <span className={`h-2.5 w-2.5 rounded-full ${optionMeta.styles.dot}`} />
                                        <span className={optionMeta.styles.text}>{optionMeta.label}</span>
                                      </span>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="p-2 align-top">
                        <MeetingDateInput
                          value={item.meeting_at}
                          onChange={(value) => handleMeetingChange(item, value)}
                          className="w-[160px] h-8 text-xs"
                        />
                      </TableCell>
                      {!isVendedor && (
                        <TableCell className="p-2 align-top">
                          <PriceInput
                            value={item.sale_price ?? null}
                            onBlur={(value) => handlePriceChange(item, "sale_price", value)}
                            className="h-8 text-xs w-[120px]"
                          />
                        </TableCell>
                      )}
                      {!isVendedor && (
                        <TableCell className="p-2 align-top text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            title="Eliminar consignacion"
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          setCreateError(null);
          if (!open) {
            if (location.search) {
              navigate(location.pathname, { replace: true });
            }
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva consignación</DialogTitle>
            <DialogDescription>
              Mismos campos y orden que la hoja «ONLINE» de <strong>STOCK ON LINE.xlsx</strong> (MODELO → PUBLICADO). Abajo puedes ampliar con inventario, CRM y seguimiento.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="space-y-4"
          >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Stock en línea (Excel)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="vehicle_model">{STOCK_ONLINE_COLUMN_LABELS.modelo}</Label>
              <Input
                id="vehicle_model"
                value={formState.vehicle_model}
                onChange={(e) => setFormState({ ...formState, vehicle_model: e.target.value })}
                placeholder="Ej: CITRÖEN C3 · HAVAL JOLION"
              />
            </div>
            <div>
              <Label htmlFor="vehicle_year">{STOCK_ONLINE_COLUMN_LABELS.anio}</Label>
              <Input
                id="vehicle_year"
                type="number"
                min={1900}
                max={2100}
                value={formState.vehicle_year}
                onChange={(e) => setFormState({ ...formState, vehicle_year: e.target.value })}
                placeholder="Ej: 2024"
              />
            </div>
            <div>
              <Label htmlFor="carroceria">{STOCK_ONLINE_COLUMN_LABELS.carroceria}</Label>
              <Input
                id="carroceria"
                value={formState.carroceria}
                onChange={(e) => setFormState({ ...formState, carroceria: e.target.value })}
                placeholder="Ej: HATCHBACK, SUV, PICK UP"
              />
            </div>
            <div>
              <Label htmlFor="vehicle_km">{STOCK_ONLINE_COLUMN_LABELS.kilometraje}</Label>
              <Input
                id="vehicle_km"
                inputMode="numeric"
                value={formState.vehicle_km}
                onChange={(e) =>
                  setFormState({ ...formState, vehicle_km: e.target.value.replace(/\D/g, "") })
                }
                placeholder="Ej: 129000"
              />
            </div>
            <div>
              <Label htmlFor="motor">{STOCK_ONLINE_COLUMN_LABELS.motor}</Label>
              <Input
                id="motor"
                value={formState.motor}
                onChange={(e) => setFormState({ ...formState, motor: e.target.value })}
                placeholder="Ej: 1.6 T · 1.5"
              />
            </div>
            <div>
              <Label htmlFor="transmision">{STOCK_ONLINE_COLUMN_LABELS.transmision}</Label>
              <Input
                id="transmision"
                value={formState.transmision}
                onChange={(e) => setFormState({ ...formState, transmision: e.target.value })}
                placeholder="Ej: MECANICO, AUTOMATICO"
              />
            </div>
            <div>
              <Label htmlFor="combustible">{STOCK_ONLINE_COLUMN_LABELS.combustible}</Label>
              <Input
                id="combustible"
                value={formState.combustible}
                onChange={(e) => setFormState({ ...formState, combustible: e.target.value })}
                placeholder="Ej: DIESEL, BENCINA, HIBRIDA"
              />
            </div>
            <div>
              <Label htmlFor="patente">{STOCK_ONLINE_COLUMN_LABELS.patente}</Label>
              <Input
                id="patente"
                value={formState.patente}
                onChange={(e) => setFormState({ ...formState, patente: e.target.value })}
                placeholder="Ej: KD TR 90 · PL WY 18"
              />
            </div>
            <div>
              <Label htmlFor="consignacion_price">{STOCK_ONLINE_COLUMN_LABELS.precio} (CLP)</Label>
              <Input
                id="consignacion_price"
                value={formState.consignacion_price}
                onChange={(e) =>
                  setFormState({ ...formState, consignacion_price: e.target.value })
                }
                placeholder="Ej: 8990000"
              />
            </div>
            <div>
              <Label htmlFor="owner_name">{STOCK_ONLINE_COLUMN_LABELS.consignatario}</Label>
              <Input
                id="owner_name"
                value={formState.owner_name}
                onChange={(e) => setFormState({ ...formState, owner_name: e.target.value })}
                placeholder="Ej: ELIAS"
              />
            </div>
            <div className="flex flex-row items-center justify-between rounded-lg border p-3 md:col-span-2">
              <div>
                <Label htmlFor="publicado_form" className="text-base">{STOCK_ONLINE_COLUMN_LABELS.publicado}</Label>
                <p className="text-xs text-muted-foreground">Equivalente a marcar publicado en la planilla.</p>
              </div>
              <Switch
                id="publicado_form"
                checked={formState.publicado}
                onCheckedChange={(v) => setFormState({ ...formState, publicado: v })}
              />
            </div>
          </div>

          <Collapsible open={consignacionAdvancedOpen} onOpenChange={setConsignacionAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full flex justify-between gap-2">
                <span>Opcional: inventario, CRM, contacto y seguimiento</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${consignacionAdvancedOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="vehicle_id_form">Vehículo en stock (opcional)</Label>
                  <Select
                    value={formState.vehicle_id || "__none__"}
                    onValueChange={(v) => handleVehicleChange(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger id="vehicle_id_form">
                      <SelectValue placeholder="Sin vincular a inventario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin vincular a inventario</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.year} {v.make} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="vehicle_make">Marca (opcional, para búsquedas)</Label>
                  <Input
                    id="vehicle_make"
                    value={formState.vehicle_make}
                    onChange={(e) => setFormState({ ...formState, vehicle_make: e.target.value })}
                    placeholder="Ej: Peugeot"
                  />
                </div>
                <div>
                  <Label htmlFor="lead_id_form">Lead existente (opcional)</Label>
                  <Select
                    value={formState.lead_id || "__none__"}
                    onValueChange={(v) => handleLeadChange(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger id="lead_id_form">
                      <SelectValue placeholder="Sin lead vinculado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin lead vinculado</SelectItem>
                      {leads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.full_name || l.phone || l.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="owner_phone">Teléfono</Label>
                  <Input
                    id="owner_phone"
                    value={formState.owner_phone}
                    onChange={(e) => setFormState({ ...formState, owner_phone: e.target.value })}
                    placeholder="+56 9 1234 5678"
                  />
                </div>
                <div>
                  <Label htmlFor="owner_email">Correo</Label>
                  <Input
                    id="owner_email"
                    type="email"
                    value={formState.owner_email}
                    onChange={(e) => setFormState({ ...formState, owner_email: e.target.value })}
                    placeholder="correo@ejemplo.cl"
                  />
                </div>
                <div>
                  <Label htmlFor="vehicle_vin">VIN (opcional)</Label>
                  <Input
                    id="vehicle_vin"
                    value={formState.vehicle_vin}
                    onChange={(e) => setFormState({ ...formState, vehicle_vin: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="form_status">Estado en CRM</Label>
                  <Select
                    value={formState.status}
                    onValueChange={(value) =>
                      setFormState({ ...formState, status: value as Consignacion["status"] })
                    }
                  >
                    <SelectTrigger id="form_status">
                      <SelectValue />
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
                <div>
                  <Label htmlFor="form_label">Etiqueta</Label>
                  <Select
                    value={formState.label}
                    onValueChange={(value) => setFormState({ ...formState, label: value })}
                  >
                    <SelectTrigger id="form_label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {labelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sale_price">Precio venta objetivo (CLP)</Label>
                  <Input
                    id="sale_price"
                    value={formState.sale_price}
                    onChange={(e) => setFormState({ ...formState, sale_price: e.target.value })}
                    placeholder="Ej: 9290000"
                  />
                </div>
                <div>
                  <Label htmlFor="meeting_at">Fecha reunión</Label>
                  <Input
                    id="meeting_at"
                    type="datetime-local"
                    value={formState.meeting_at}
                    onChange={(e) => setFormState({ ...formState, meeting_at: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes_form">Notas</Label>
                  <Input
                    id="notes_form"
                    value={formState.notes}
                    onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                    placeholder="Observaciones internas"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {createError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
            >
              {isCreating ? "Guardando..." : "Guardar consignacion"}
            </Button>
          </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
