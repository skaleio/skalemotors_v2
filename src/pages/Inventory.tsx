import { Camera, Download, Edit, Eye, FileText, Globe, Loader2, MoreHorizontal, Plus, ScrollText, Search, Trash2, Users, X } from "lucide-react";
import { documentService, type Document } from "@/lib/services/documents";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useVehicles } from "@/hooks/useVehicles";
import { VehicleImage } from "@/components/VehicleImage";
import { VehicleConsignacionPanel } from "@/components/inventory/VehicleConsignacionPanel";
import {
  VehicleStatusPicker,
  VehicleStatusLabel,
  type VehicleStatus,
  VEHICLE_STATUS_LABELS as statusLabels,
} from "@/components/inventory/VehicleStatusPicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  canAddInventoryVehicle,
  canViewInventoryPrice,
  hidesInventoryCosts,
  isPhotographerRole,
} from "@/lib/appRoles";
import { formatCLP, formatPatente, formatVehicleLabel, isValidPatente, normalizePatente } from "@/lib/format";
import { leadService } from "@/lib/services/leads";
import { saleService } from "@/lib/services/sales";
import { vehicleService } from "@/lib/services/vehicles";
import { lookupVehicleByPatente } from "@/lib/services/vehicleAppraisalService";
import { DASHBOARD_STATS_QUERY_KEY } from "@/hooks/useDashboardStats";
import { optimizeVehicleImageForUpload } from "@/lib/vehicleImageOptimize";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import {
  listListingsForBranch,
  listConnections,
  publishVehicle,
  type MarketplacePlatform,
  type VehicleListingRow,
} from "@/lib/services/marketplaceApi";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];

type LeadWithAssignee = Lead & {
  assigned_user?: { id: string; full_name?: string | null; email?: string | null } | null;
};

const LEAD_STATUS_LABELS_ES: Record<string, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  interesado: "Interesado",
  cotizando: "Cotizando",
  negociando: "Negociando",
  vendido: "Vendido",
  perdido: "Perdido",
  en_espera: "En espera",
  para_cierre: "Para cierre",
};

function truncateSnippet(text: string | null | undefined, max: number) {
  if (text == null || text === "") return "—";
  const t = String(text).trim();
  if (!t) return "—";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

type ConsignmentType = "fisica" | "digital";

const consignmentTypeLabels: Record<ConsignmentType, string> = {
  fisica: "Física",
  digital: "Digital",
};

/** Encabezados alineados con la hoja «ONLINE» de STOCK ON LINE.xlsx */
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

function normalizeForMatch(s: string) {
  return s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function deriveFuelTypeFromExcelText(text: string): "gasolina" | "diesel" | "híbrido" | "eléctrico" {
  const u = normalizeForMatch(text);
  if (!u) return "gasolina";
  if (u.includes("DIESEL")) return "diesel";
  if (u.includes("HIBR")) return "híbrido";
  if (u.includes("ELECT")) return "eléctrico";
  return "gasolina";
}

function deriveTransmissionFromExcelText(text: string): "manual" | "automático" | "cvt" {
  const u = normalizeForMatch(text);
  if (!u) return "automático";
  if (u.includes("MECAN") || u === "MANUAL") return "manual";
  if (u.includes("CVT")) return "cvt";
  return "automático";
}

function transmissionToDisplayLabel(t: string | null | undefined): string {
  if (!t) return "";
  if (t === "manual") return "Manual";
  if (t === "cvt" || t === "automático") return "Automática";
  return String(t);
}

function fuelTypeToDisplayLabel(f: string | null | undefined): string {
  if (!f) return "";
  if (f === "diesel") return "Diesel";
  if (f === "gasolina") return "Gasolina";
  return String(f);
}

/** Valores del dropdown de carrocería (formulario stock). */
const INVENTORY_CARROCERIA_OPTIONS = [
  "Hatchback",
  "Sedán",
  "SUV",
  "Camioneta",
  "Pick-up",
  "Furgón",
  "Jeep",
  "Deportivo",
  "Station wagon",
  "Van",
  "Coupé",
] as const;

const INVENTORY_TRANSMISION_OPTIONS = [
  { value: "Manual", transmission: "manual" as const },
  { value: "Automática", transmission: "automático" as const },
] as const;

const INVENTORY_COMBUSTIBLE_OPTIONS = [
  { value: "Gasolina", fuel_type: "gasolina" as const },
  { value: "Diesel", fuel_type: "diesel" as const },
] as const;

function normalizeInventoryCarroceria(raw: string): string {
  const u = normalizeForMatch(raw);
  if (!u) return "";
  if (u.includes("SUV")) return "SUV";
  if (u.includes("SEDAN")) return "Sedán";
  if (u.includes("HATCH")) return "Hatchback";
  if (u.includes("CAMIONETA") || u.includes("PICK UP") || u.includes("PICKUP")) {
    return u.includes("PICK") ? "Pick-up" : "Camioneta";
  }
  if (u.includes("FURGON") || u.includes("FURGÓN")) return "Furgón";
  if (u.includes("JEEP")) return "Jeep";
  if (u.includes("DEPORT")) return "Deportivo";
  if (u.includes("STATION") || u.includes("WAGON") || u.includes("FAMILIAR")) return "Station wagon";
  if (u.includes("VAN") || u.includes("MINIVAN")) return "Van";
  if (u.includes("COUPE") || u.includes("COUP")) return "Coupé";
  return raw.trim();
}

function normalizeInventoryTransmisionDisplay(
  raw: string,
  transmission?: string | null,
): string {
  const u = normalizeForMatch(raw);
  if (u.includes("MECAN") || u === "MANUAL") return "Manual";
  if (u.includes("AUTOM") || u.includes("CVT")) return "Automática";
  if (raw === "Manual" || raw === "Automática") return raw;
  if (transmission === "manual") return "Manual";
  if (transmission === "automático" || transmission === "cvt") return "Automática";
  return raw.trim();
}

function normalizeInventoryCombustibleDisplay(raw: string, fuelType?: string | null): string {
  const u = normalizeForMatch(raw);
  if (u.includes("DIESEL")) return "Diesel";
  if (u.includes("BENCIN") || u.includes("GASOLIN")) return "Gasolina";
  if (raw === "Gasolina" || raw === "Diesel") return raw;
  if (fuelType === "diesel") return "Diesel";
  if (fuelType === "gasolina") return "Gasolina";
  return raw.trim();
}

function legacySelectItem(value: string, options: readonly string[]) {
  if (!value || options.includes(value)) return null;
  return (
    <SelectItem key={`legacy-${value}`} value={value}>
      {value} (anterior)
    </SelectItem>
  );
}

type VehicleFormPublicationFooterProps = {
  publicado: boolean;
  onPublicadoChange: (checked: boolean) => void;
  publishSwitchId: string;
  onCancel: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  submitLabel: string;
  status?: VehicleStatus;
  onStatusChange?: (status: VehicleStatus) => void;
  showStatus?: boolean;
};

function VehicleFormPublicationFooter({
  publicado,
  onPublicadoChange,
  publishSwitchId,
  onCancel,
  onSubmit,
  isSaving,
  submitLabel,
  status,
  onStatusChange,
  showStatus,
}: VehicleFormPublicationFooterProps) {
  return (
    <div className="mt-6 space-y-4 rounded-xl border border-primary/20 bg-muted/40 p-4 md:p-5">
      <div>
        <p className="text-sm font-semibold">Publicación y guardado</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Indica si el vehículo queda marcado como publicado en stock y confirma los cambios del formulario.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 sm:col-span-2">
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor={publishSwitchId} className="cursor-pointer text-sm font-medium">
              {STOCK_ONLINE_COLUMN_LABELS.publicado}
            </Label>
            <p className="text-xs text-muted-foreground">
              {publicado
                ? "Aparecerá como publicado en tu inventario / planilla."
                : "Quedará sin marcar como publicado hasta que lo actives."}
            </p>
          </div>
          <Switch
            id={publishSwitchId}
            checked={publicado}
            onCheckedChange={onPublicadoChange}
            className="shrink-0"
          />
        </div>

        {showStatus && status && onStatusChange ? (
          <div className="sm:col-span-2 sm:max-w-xs">
            <Label htmlFor={`${publishSwitchId}-status`}>Estado del vehículo</Label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger id={`${publishSwitchId}-status`}>
                <SelectValue placeholder="Estado del vehículo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([key]) => (
                  <SelectItem key={key} value={key}>
                    <VehicleStatusLabel statusKey={key} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
        >
          {isSaving ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function createEmptyNewVehicle() {
  return {
    make: "",
    model: "",
    year: 0,
    color: "",
    mileage: 0,
    owner_name: "",
    owner_phone: "",
    consignment_type: "fisica" as ConsignmentType,
    patente: "",
    consignatario_staff_id: "",
    carroceria: "",
    transmision_display: "",
    combustible_display: "",
    engine_number: "",
    vin: "",
    version: "",
    doors: 0,
    getapiExtras: {} as Record<string, unknown>,
    publicado: false,
    price: 0,
    cost: 0,
    minDownPayment: 0,
    engine_size: "",
    fuel_type: "gasolina" as "gasolina" | "diesel" | "híbrido" | "eléctrico",
    transmission: "automático" as "manual" | "automático" | "cvt",
    location: "",
    drivetrain: "",
    images: [] as File[],
    status: "disponible" as VehicleStatus,
  };
}

const getVehicleConsignmentType = (vehicle: Vehicle): ConsignmentType => {
  const t = vehicle.consignment_type;
  if (t === "digital" || t === "fisica") return t;
  return "fisica";
};

// Funciones helper para formatear números con puntos (formato chileno)
const formatNumberInput = (value: string): string => {
  try {
    // Remover todo excepto números y puntos
    const cleaned = value.replace(/[^\d.]/g, '');
    // Asegurar que solo haya un punto
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return cleaned;
  } catch (error) {
    console.error('Error en formatNumberInput:', error);
    return '';
  }
};

const parseNumberInput = (value: string): number => {
  try {
    // Remover puntos y convertir a número
    const cleaned = value.replace(/\./g, '');
    const parsed = parseFloat(cleaned);
    // Validar que sea un número válido
    if (isNaN(parsed) || !isFinite(parsed)) {
      return 0;
    }
    return parsed;
  } catch (error) {
    console.error('Error en parseNumberInput:', error);
    return 0;
  }
};

/** Pie mínimo = 30% del precio de venta (no del costo). */
const MIN_DOWN_PAYMENT_RATE = 0.3;

function minDownPaymentFromSalePrice(salePrice: number): number {
  const price = Math.max(0, Math.round(salePrice));
  return Math.round(price * MIN_DOWN_PAYMENT_RATE);
}

type NewVehicleFormState = ReturnType<typeof createEmptyNewVehicle>;

function patchVehicleSalePrice(prev: NewVehicleFormState, salePrice: number): NewVehicleFormState {
  return {
    ...prev,
    price: salePrice,
    minDownPayment: minDownPaymentFromSalePrice(salePrice),
  };
}

const formatNumberDisplay = (value: number): string => {
  try {
    // Validar que sea un número válido
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return '';
    }
    if (value === 0) return '';
    // Formatear con puntos como separadores de miles
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } catch (error) {
    console.error('Error en formatNumberDisplay:', error);
    return '';
  }
};

const generateVin = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
  const raw = `SK${ts}${rnd}`.replace(/[^A-Z0-9]/g, '');
  return raw.substring(0, 17).padEnd(17, '0');
};

const PLACEHOLDER_VEHICLE_IMAGE = "/placeholder.svg";

/** Evita http en sitios https (iOS puede bloquear mixed content) y descarta URLs vacías. */
const normalizeVehicleImageUrl = (raw: string | null | undefined): string | null => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("blob:") || s.startsWith("data:")) return s;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://localhost";
    const u = new URL(s, base);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch {
    return s || null;
  }
};

const firstVehicleImageUrl = (images: unknown): string => {
  const list = images as string[] | null | undefined;
  if (!Array.isArray(list)) return PLACEHOLDER_VEHICLE_IMAGE;
  for (const item of list) {
    const n = normalizeVehicleImageUrl(typeof item === "string" ? item : null);
    if (n) return n;
  }
  return PLACEHOLDER_VEHICLE_IMAGE;
};

const vehicleImageUrlList = (images: unknown): string[] => {
  const list = images as string[] | null | undefined;
  if (!Array.isArray(list)) return [PLACEHOLDER_VEHICLE_IMAGE];
  const out: string[] = [];
  for (const item of list) {
    const n = normalizeVehicleImageUrl(typeof item === "string" ? item : null);
    if (n) out.push(n);
  }
  return out.length ? out : [PLACEHOLDER_VEHICLE_IMAGE];
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function LocalFilePreview({
  file,
  alt,
  className,
  displayWidth,
  displayHeight,
}: {
  file: File;
  alt: string;
  className?: string;
  displayWidth?: number;
  displayHeight?: number;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      width={displayWidth}
      height={displayHeight}
    />
  );
}

const uploadVehicleImage = async (
  file: File,
  fileName: string,
  accessToken: string,
) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan variables de entorno de Supabase");
  }

  if (!allowedImageTypes.includes(file.type)) {
    throw new Error(`Formato no permitido: ${file.type || "desconocido"}`);
  }

  const optimizedFile = await optimizeVehicleImageForUpload(file);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/vehicles/${fileName}`, {
    method: "PUT",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": optimizedFile.type,
      "x-upsert": "false",
    },
    body: optimizedFile,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Error subiendo imagen (${response.status}): ${errorBody || response.statusText}`);
  }
};

const updateVehicleImages = async (
  vehicleId: string,
  imageUrls: string[],
  accessToken: string,
) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan variables de entorno de Supabase");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/vehicles?id=eq.${vehicleId}`, {
    method: "PATCH",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ images: imageUrls }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Error actualizando imágenes (${response.status}): ${errorBody || response.statusText}`);
  }
};

export default function Inventory() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const hidesCosts = hidesInventoryCosts(user?.role);
  const showPrice = canViewInventoryPrice(user?.role);
  const isPhotographer = isPhotographerRole(user?.role);
  const showInventoryActions = !hidesCosts || isPhotographer;
  const inventoryTableColSpan =
    5 + (showPrice ? 1 : 0) + (!hidesCosts ? 1 : 0) + (showInventoryActions ? 1 : 0);
  // Sin filtrar por sucursal al cargar: mostrar todos los vehículos (los datos pueden tener branch_id distinto o NULL)
  const { vehicles, loading, isFetching, error: vehiclesError, refetch } = useVehicles({
    branchId: undefined,
    enabled: true,
    mode: "list",
  });

  const [statusUpdatingVehicleId, setStatusUpdatingVehicleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedMake, setSelectedMake] = useState<string>("all");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicleFull, setSelectedVehicleFull] = useState<Vehicle | null>(null);
  const [selectedVehicleLoading, setSelectedVehicleLoading] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle | null>(null);
  const [vehicleToSell, setVehicleToSell] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [patenteLookupLoading, setPatenteLookupLoading] = useState(false);
  const [vehicleFormRevealed, setVehicleFormRevealed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportScope, setExportScope] = useState<"all" | "filtered">("all");
  const [exportDetail, setExportDetail] = useState<"basic" | "full">("full");
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("xlsx");
  const [exportFileName, setExportFileName] = useState(() => {
    const fileDate = new Date().toISOString().split("T")[0];
    return `inventario_${fileDate}`;
  });
  const [hasRetriedEmpty, setHasRetriedEmpty] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [saleData, setSaleData] = useState({
    salePrice: 0,
    downPayment: 0,
    paymentMethod: 'contado',
    notes: ''
  });
  const [newVehicle, setNewVehicle] = useState(createEmptyNewVehicle);

  const [listingsByVehicle, setListingsByVehicle] = useState<Record<string, VehicleListingRow[]>>({});
  const [marketplaceConnections, setMarketplaceConnections] = useState<{ platform: MarketplacePlatform }[]>([]);
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [leadsMatchVehicle, setLeadsMatchVehicle] = useState<Vehicle | null>(null);

  // Contratos generados por vehículo (para verlos/abrirlos desde el inventario/consignaciones).
  const { data: vehicleDocuments = [] } = useQuery({
    queryKey: ["inventory-vehicle-documents", user?.tenant_id],
    queryFn: () => documentService.getAll(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const documentsByVehicle = useMemo(() => {
    const map: Record<string, Document[]> = {};
    for (const d of vehicleDocuments) {
      if (!d.vehicle_id) continue;
      (map[d.vehicle_id] ??= []).push(d);
    }
    return map;
  }, [vehicleDocuments]);

  const branchId = user?.branch_id ?? null;

  const {
    data: rawMatchingLeads = [],
    isLoading: matchingLeadsLoading,
    error: matchingLeadsError,
  } = useQuery({
    queryKey: ["inventory-vehicle-matching-leads", leadsMatchVehicle?.id, user?.branch_id],
    queryFn: () =>
      leadService.listMatchingVehicle({
        vehicleId: leadsMatchVehicle!.id,
        make: leadsMatchVehicle!.make || "",
        model: leadsMatchVehicle!.model || "",
        branchId: user?.branch_id ?? undefined,
      }),
    enabled: !!leadsMatchVehicle?.id && !!user,
  });

  const matchingLeadsSorted = useMemo(() => {
    const vid = leadsMatchVehicle?.id;
    if (!vid) return [] as LeadWithAssignee[];
    const closed = new Set(["vendido", "perdido"]);
    return [...(rawMatchingLeads as LeadWithAssignee[])].sort((a, b) => {
      const ac = closed.has((a.status || "").toLowerCase()) ? 1 : 0;
      const bc = closed.has((b.status || "").toLowerCase()) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      const ap = a.preferred_vehicle_id === vid ? 0 : 1;
      const bp = b.preferred_vehicle_id === vid ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [rawMatchingLeads, leadsMatchVehicle?.id]);

  const { data: salesStaff = [] } = useQuery({
    queryKey: ["inventory_branch_sales_staff", user?.tenant_id, user?.branch_id],
    enabled: !!user?.tenant_id,
    queryFn: async () => {
      let q = supabase
        .from("branch_sales_staff")
        .select("id, full_name, role_label")
        .eq("tenant_id", user!.tenant_id!)
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      if (user!.branch_id) {
        q = q.or(`branch_id.eq.${user.branch_id},branch_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string; role_label: string }[];
    },
  });

  useEffect(() => {
    if (!branchId || !vehicles.length) {
      setListingsByVehicle({});
      setMarketplaceConnections([]);
      return;
    }
    const vehicleIds = vehicles.map((v) => v.id);
    listListingsForBranch(vehicleIds)
      .then((listings) => {
        const byVehicle: Record<string, VehicleListingRow[]> = {};
        for (const l of listings) {
          if (!byVehicle[l.vehicle_id]) byVehicle[l.vehicle_id] = [];
          byVehicle[l.vehicle_id].push(l);
        }
        setListingsByVehicle(byVehicle);
      })
      .catch(() => setListingsByVehicle({}));
    listConnections(branchId)
      .then((conns) => setMarketplaceConnections(conns.filter((c) => c.status === "active").map((c) => ({ platform: c.platform }))))
      .catch(() => setMarketplaceConnections([]));
  }, [branchId, vehicles]);

  const handlePublishToPlatform = async (vehicleId: string, platform: MarketplacePlatform) => {
    const key = `${vehicleId}:${platform}`;
    setPublishingKey(key);
    try {
      await publishVehicle(vehicleId, platform);
      const name = platform === "mercadolibre" ? "Mercado Libre" : platform === "facebook" ? "Facebook" : "Chile Autos";
      toast({ title: "Publicado", description: `Vehículo publicado en ${name}.` });
      const listings = await listListingsForBranch([vehicleId]);
      setListingsByVehicle((prev) => {
        const byVehicle = { ...prev };
        byVehicle[vehicleId] = listings;
        return byVehicle;
      });
    } catch (e) {
      toast({
        title: "Error al publicar",
        description: e instanceof Error ? e.message : "No se pudo publicar en la plataforma.",
        variant: "destructive",
      });
    } finally {
      setPublishingKey(null);
    }
  };

  const isFilterActive =
    searchQuery.trim() !== "" ||
    selectedStatus !== "all" ||
    selectedType !== "all" ||
    selectedMake !== "all";

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const matchesSearch =
        searchQuery === "" ||
        vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vehicle.vin || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (vehicle.patente || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === "all" || vehicle.status === selectedStatus;
      const matchesType =
        selectedType === "all" || getVehicleConsignmentType(vehicle) === selectedType;
      const matchesMake = selectedMake === "all" || vehicle.make === selectedMake;
      return matchesSearch && matchesStatus && matchesType && matchesMake;
    });
  }, [vehicles, searchQuery, selectedMake, selectedStatus, selectedType]);

  // Un solo reintento cuando la carga terminó y llegó vacío (p. ej. fallo transitorio), con delay para no pisar la primera petición
  useEffect(() => {
    if (loading) return;
    if (vehicles.length > 0) return;
    if (hasRetriedEmpty) return;
    const t = setTimeout(() => {
      setHasRetriedEmpty(true);
      refetch();
    }, 2200);
    return () => clearTimeout(t);
  }, [loading, vehicles.length, hasRetriedEmpty, refetch]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "true") {
      setShowAddDialog(true);
    }
  }, [location.search]);

  // Sincronizar modal de detalle con la URL (?vehicle=...) para que el botón Atrás
  // cierre el detalle y no saque al usuario a otra página.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const vehicleId = params.get("vehicle");

    if (!vehicleId) {
      if (selectedVehicle) {
        setSelectedVehicle(null);
        setSelectedVehicleFull(null);
        setSelectedVehicleLoading(false);
      }
      return;
    }

    if (selectedVehicle?.id === vehicleId) return;

    const found = vehicles.find((v) => v.id === vehicleId);
    if (found) {
      setSelectedVehicle(found);
      return;
    }

    let cancelled = false;
    setSelectedVehicleLoading(true);
    vehicleService
      .getById(vehicleId)
      .then((full) => {
        if (cancelled) return;
        setSelectedVehicle(full as any);
        setSelectedVehicleFull(full as any);
      })
      .catch(() => {
        if (cancelled) return;
        // Si no se puede cargar, limpiar param para no dejar al usuario “atrapado”
        const next = new URLSearchParams(location.search);
        next.delete("vehicle");
        navigate({ pathname: location.pathname, search: next.toString() ? `?${next.toString()}` : "" }, { replace: true });
      })
      .finally(() => {
        if (cancelled) return;
        setSelectedVehicleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate, selectedVehicle, vehicles]);

  useEffect(() => {
    if (!selectedVehicle?.id) return;
    const params = new URLSearchParams(location.search);
    if (params.get("vehicle") === selectedVehicle.id) return;
    params.set("vehicle", selectedVehicle.id);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle?.id]);

  const closeVehicleDetailModal = () => {
    const params = new URLSearchParams(location.search);
    if (params.has("vehicle")) {
      params.delete("vehicle");
      navigate(
        {
          pathname: location.pathname,
          search: params.toString() ? `?${params.toString()}` : "",
        },
        { replace: true },
      );
    }
    setSelectedVehicle(null);
    setSelectedVehicleFull(null);
    setSelectedVehicleLoading(false);
  };

  const openVehicleEditor = (vehicle: Vehicle) => {
    setIsSaving(true);
    vehicleService
      .getById(vehicle.id)
      .then((full) => {
        setVehicleToEdit(full as any);
        closeVehicleDetailModal();
      })
      .finally(() => setIsSaving(false));
  };

  useEffect(() => {
    const handleOpenNewVehicleForm = () => setShowAddDialog(true);
    window.addEventListener("openNewVehicleForm", handleOpenNewVehicleForm);
    return () => window.removeEventListener("openNewVehicleForm", handleOpenNewVehicleForm);
  }, []);

  const uniqueMakes = useMemo(() => {
    return Array.from(new Set(vehicles.map((v) => v.make))).sort();
  }, [vehicles]);

  const totalValue = filteredVehicles.reduce((sum, v) => sum + Number(v.price || 0), 0);
  const totalMargin = filteredVehicles.reduce((sum, v) => sum + Number(v.margin || 0), 0);

  const {
    pagedItems: pagedVehicles,
    page: vehiclesPage,
    setPage: setVehiclesPage,
    pageSize: vehiclesPageSize,
    setPageSize: setVehiclesPageSize,
    totalPages: vehiclesTotalPages,
    totalItems: vehiclesTotalItems,
  } = usePagination(filteredVehicles, 25);

  const handleVehicleStatusChange = async (vehicle: Vehicle, next: VehicleStatus) => {
    const current = (vehicle.status || "disponible") as VehicleStatus;
    if (current === next) return;

    setStatusUpdatingVehicleId(vehicle.id);
    try {
      await vehicleService.update(vehicle.id, { status: next });
      toast({
        title: "Estado actualizado",
        description: `${vehicle.make} ${vehicle.model}: ${statusLabels[next]}`,
      });
      refetch();
      if (selectedVehicle?.id === vehicle.id) {
        setSelectedVehicle({ ...selectedVehicle, status: next });
      }
      if (selectedVehicleFull?.id === vehicle.id) {
        setSelectedVehicleFull({ ...selectedVehicleFull, status: next });
      }
    } catch (e) {
      toast({
        title: "No se pudo cambiar el estado",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setStatusUpdatingVehicleId(null);
    }
  };

  const selectedVehicleComputed = useMemo(() => {
    const base = selectedVehicleFull || selectedVehicle;
    if (!base) return null;
    const margin = Number(base.margin ?? 0);
    const price = Number(base.price ?? 0);
    const minDownPayment = minDownPaymentFromSalePrice(price);
    const engine = base.engine_size || "—";

    return {
      margin,
      minDownPayment,
      engine,
      consignmentLabel: consignmentTypeLabels[getVehicleConsignmentType(base)],
      ownerName: (base.owner_name || "").trim() || "—",
      ownerPhone: (base.owner_phone || "").trim() || "—",
      location: base.location || "—",
      drivetrain: "—",
      trunkCapacityLiters: "—",
      sunroof: "—",
    };
  }, [selectedVehicle, selectedVehicleFull]);

  useEffect(() => {
    let cancelled = false;
    const id = selectedVehicle?.id;
    if (!id) {
      setSelectedVehicleFull(null);
      setSelectedVehicleLoading(false);
      return;
    }
    setSelectedVehicleLoading(true);
    vehicleService
      .getById(id)
      .then((full) => {
        if (cancelled) return;
        setSelectedVehicleFull(full as any);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedVehicleFull(null);
      })
      .finally(() => {
        if (cancelled) return;
        setSelectedVehicleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVehicle?.id]);

  // Pre-llenar formulario cuando se selecciona un vehículo para editar
  useEffect(() => {
    if (vehicleToEdit) {
      const features = (vehicleToEdit.features as any) || {};
      setNewVehicle({
        make: vehicleToEdit.make || "",
        model: vehicleToEdit.model || "",
        year: vehicleToEdit.year || new Date().getFullYear(),
        color: vehicleToEdit.color || "",
        mileage: vehicleToEdit.mileage || 0,
        owner_name: vehicleToEdit.owner_name || "",
        owner_phone: vehicleToEdit.owner_phone || "",
        consignment_type: getVehicleConsignmentType(vehicleToEdit),
        patente: formatPatente(vehicleToEdit.patente || ""),
        consignatario_staff_id: vehicleToEdit.consignatario_staff_id || "",
        carroceria: normalizeInventoryCarroceria(vehicleToEdit.carroceria ?? ""),
        transmision_display: normalizeInventoryTransmisionDisplay(
          (vehicleToEdit.transmision_display || "").trim() ||
            transmissionToDisplayLabel(vehicleToEdit.transmission),
          vehicleToEdit.transmission,
        ),
        combustible_display: normalizeInventoryCombustibleDisplay(
          (vehicleToEdit.combustible_display || "").trim() ||
            fuelTypeToDisplayLabel(vehicleToEdit.fuel_type),
          vehicleToEdit.fuel_type,
        ),
        publicado: vehicleToEdit.publicado ?? false,
        price: Number(vehicleToEdit.price || 0),
        cost: Number(vehicleToEdit.cost || 0),
        minDownPayment: minDownPaymentFromSalePrice(Number(vehicleToEdit.price || 0)),
        engine_size: vehicleToEdit.engine_size || "",
        engine_number: (vehicleToEdit as any).engine_number || "",
        vin: vehicleToEdit.vin || "",
        fuel_type: vehicleToEdit.fuel_type || "gasolina",
        transmission: vehicleToEdit.transmission || "automático",
        location: vehicleToEdit.location || "",
        drivetrain: features.drivetrain || "",
        images: [], // Las imágenes existentes se mantienen en el vehículo, solo se pueden agregar nuevas
        status: (vehicleToEdit.status || "disponible") as VehicleStatus,
      });
    }
  }, [vehicleToEdit]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    setNewVehicle((prev) => ({
      ...prev,
      images: [...prev.images, ...fileArray],
    }));
  };

  const removeImage = (index: number) => {
    setNewVehicle((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleBuscarPatente = async () => {
    const normalized = normalizePatente(newVehicle.patente);
    if (!isValidPatente(normalized)) {
      toast({ variant: "destructive", title: "Patente inválida", description: "Patente chilena: BCDF12 (actual), AB1234 (antigua) o ABC12 (moto)." });
      return;
    }
    setPatenteLookupLoading(true);
    try {
      const vehicle = await lookupVehicleByPatente(normalized);
      setNewVehicle((prev) => {
        // Normalizar transmisión/combustible/carrocería de GetAPI al formato del
        // selector y derivar los enums internos (transmission/fuel_type), para que
        // queden seleccionados automáticamente y no como valor "anterior".
        const transDisplay = vehicle.transmision
          ? normalizeInventoryTransmisionDisplay(vehicle.transmision)
          : prev.transmision_display;
        const transMatch = INVENTORY_TRANSMISION_OPTIONS.find((o) => o.value === transDisplay);
        const combDisplay = vehicle.combustible
          ? normalizeInventoryCombustibleDisplay(vehicle.combustible)
          : prev.combustible_display;
        const combMatch = INVENTORY_COMBUSTIBLE_OPTIONS.find((o) => o.value === combDisplay);
        const carroceriaNorm = vehicle.tipo_vehiculo
          ? normalizeInventoryCarroceria(vehicle.tipo_vehiculo)
          : prev.carroceria;
        return {
          ...prev,
          patente: formatPatente(normalized),
          make: vehicle.marca || prev.make,
          model: vehicle.modelo || prev.model,
          year: vehicle.año && vehicle.año > 0 ? vehicle.año : prev.year,
          color: vehicle.color || prev.color,
          mileage: typeof vehicle.kilometraje === "number" ? vehicle.kilometraje : prev.mileage,
          engine_size: vehicle.motor || prev.engine_size,
          engine_number: vehicle.n_motor || prev.engine_number,
          vin: vehicle.n_chasis || prev.vin,
          transmision_display: transDisplay,
          transmission: transMatch?.transmission ?? prev.transmission,
          combustible_display: combDisplay,
          fuel_type: combMatch?.fuel_type ?? prev.fuel_type,
          version: vehicle.version || prev.version,
          carroceria: carroceriaNorm,
          doors:
            typeof vehicle.puertas === "number" && vehicle.puertas > 0
              ? vehicle.puertas
              : prev.doors,
          getapiExtras: {
            mes_revision_tecnica: vehicle.mes_revision_tecnica || null,
            tasacion_fiscal: vehicle.tasacion_fiscal ?? null,
            codigo_sii: vehicle.codigo_sii || null,
            foto_url: vehicle.foto_url || null,
          },
        };
      });
      setVehicleFormRevealed(true);
      toast({ title: "Datos cargados", description: `${vehicle.marca} ${vehicle.modelo} ${vehicle.año} — revisá y completá lo que falte.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo obtener los datos de la patente.";
      toast({ variant: "destructive", title: "No se pudo autocompletar", description: message });
    } finally {
      setPatenteLookupLoading(false);
    }
  };

  const handleCreateVehicle = async () => {
    if (!user?.branch_id) {
      toast({ variant: "destructive", title: "Sin sucursal asignada", description: "Contactá al administrador para que te asigne una sucursal." });
      console.error("No hay sucursal asignada");
      return;
    }

    setIsSaving(true);
    try {
      // Calcular margen
      const margin = newVehicle.price - newVehicle.cost;
      const salePrice = Number(newVehicle.price || 0);
      const minDownPayment = minDownPaymentFromSalePrice(salePrice);
      const fuelDerived = deriveFuelTypeFromExcelText(newVehicle.combustible_display);
      const transDerived = deriveTransmissionFromExcelText(newVehicle.transmision_display);

      // Preparar features con campos adicionales
      const features = {
        drivetrain: newVehicle.drivetrain || null,
        min_down_payment: minDownPayment,
        version: newVehicle.version?.trim() || null,
        ...newVehicle.getapiExtras,
      };

      // Crear el vehículo primero (sin imágenes)
      // Asegurar que los números sean del tipo correcto para Supabase
      const vinToCreate = newVehicle.vin?.trim() || generateVin();
      const fallbackYear = new Date().getFullYear();
      const patenteVal = normalizePatente(newVehicle.patente) || null;
      const vehicleData = {
        vin: vinToCreate,
        make: newVehicle.make.trim() || "Sin marca",
        model: newVehicle.model.trim() || "Sin modelo",
        year: newVehicle.year && Number(newVehicle.year) > 0 ? Number(newVehicle.year) : fallbackYear,
        color: newVehicle.color.trim() || "Sin color",
        mileage: newVehicle.mileage ? Number(newVehicle.mileage) : null,
        fuel_type: fuelDerived,
        transmission: transDerived,
        engine_size: newVehicle.engine_size?.trim() || null,
        engine_number: newVehicle.engine_number?.trim() || null,
        category: "consignado" as const,
        owner_name: newVehicle.owner_name?.trim() || null,
        owner_phone: newVehicle.owner_phone?.trim() || null,
        consignment_type: newVehicle.consignment_type,
        patente: patenteVal,
        consignatario_staff_id: newVehicle.consignatario_staff_id.trim() || null,
        carroceria: newVehicle.carroceria?.trim() || null,
        transmision_display: newVehicle.transmision_display?.trim() || null,
        combustible_display: newVehicle.combustible_display?.trim() || null,
        publicado: newVehicle.publicado,
        price: Number(newVehicle.price || 0),
        cost: newVehicle.cost ? Number(newVehicle.cost) : null,
        margin: Number(margin),
        status: "disponible" as const,
        branch_id: user.branch_id,
        ...(user.tenant_id ? { tenant_id: user.tenant_id } : {}),
        location: newVehicle.location?.trim() || null,
        doors: newVehicle.doors ? Number(newVehicle.doors) : null,
        images: [], // Inicialmente vacío, se llenará después de subir las imágenes
        features: features as any,
      };

      // Crear vehículo (incluye timeout interno y verificación)
      const createdVehicle = await vehicleService.create(vehicleData, {
        accessToken: session?.access_token
      }) as any;

      // Subir imágenes a Supabase Storage
      if (newVehicle.images.length > 0) {
        const imageUrls: string[] = [];
        const accessToken = session?.access_token;
        if (!accessToken) {
          throw new Error("No hay sesión activa para subir imágenes.");
        }

        for (const file of newVehicle.images) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${createdVehicle.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            await uploadVehicleImage(file, fileName, accessToken);

            // Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
              .from('vehicles')
              .getPublicUrl(fileName);

            imageUrls.push(publicUrl);
          } catch (error) {
            console.error("❌ Error procesando imagen:", error);
          }
        }

        // Actualizar vehículo con las URLs de las imágenes
        if (imageUrls.length > 0) {
          try {
            await updateVehicleImages(createdVehicle.id, imageUrls, accessToken);
          } catch (updateError: any) {
            console.error("❌ Error actualizando vehículo con imágenes:", updateError);
            // No lanzar error, el vehículo ya fue creado
            // Las imágenes se pueden agregar después manualmente
          }
        } else {
          console.warn("⚠️ No se pudieron subir las imágenes");
        }
      }

      // Cerrar diálogo primero
      setShowAddDialog(false);

      // Resetear formulario
      setNewVehicle(createEmptyNewVehicle());

      // Refetch con timeout para evitar que se quede colgado
      // Usar un solo refetch con manejo robusto de errores
      try {
        const refetchPromise = refetch();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout en refetch')), 8000)
        );

        await Promise.race([refetchPromise, timeoutPromise]);
      } catch (refetchError: any) {
        console.warn("⚠️ Error o timeout en refetch, pero el vehículo fue creado:", refetchError);
        // Intentar refetch en segundo plano sin bloquear
        setTimeout(() => {
          refetch().catch(err => {
            console.error("Error en refetch manual:", err);
            // No hacer nada más, el vehículo ya fue creado
          });
        }, 500);
      }
    } catch (error: any) {
      console.error("❌ Error creando vehículo:", error);
      console.error("Detalles del error:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });

      // Mensaje de error más claro para el usuario
      let errorMessage = error?.message || "Error desconocido al crear el vehículo";

      // Si el error es sobre permisos o sesión
      if (errorMessage.includes("sesión") || errorMessage.includes("permisos")) {
        errorMessage = "Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.";
      }

      toast({ variant: "destructive", title: "Error al crear vehículo", description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateVehicle = async () => {
    if (!vehicleToEdit || !user?.branch_id) {
      toast({ variant: "destructive", title: "Faltan datos", description: "No hay vehículo seleccionado o sucursal asignada." });
      return;
    }

    setIsSaving(true);
    try {
      if (isPhotographer) {
        const patch: { images?: unknown; price?: number; margin?: number } = {};
        const nextPrice = Number(newVehicle.price || 0);
        const prevPrice = Number(vehicleToEdit.price || 0);
        if (nextPrice !== prevPrice) {
          patch.price = nextPrice;
          const cost = Number(vehicleToEdit.cost || 0);
          patch.margin = nextPrice - cost;
        }

        if (newVehicle.images.length > 0) {
          const imageUrls: string[] = [];
          const existingImages = (vehicleToEdit.images as unknown as string[] | null) || [];
          for (const file of newVehicle.images) {
            try {
              const fileExt = file.name.split(".").pop();
              const fileName = `${vehicleToEdit.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
              const optimizedFile = await optimizeVehicleImageForUpload(file);
              const { error: uploadError } = await supabase.storage
                .from("vehicles")
                .upload(fileName, optimizedFile, {
                  cacheControl: "3600",
                  upsert: false,
                  contentType: optimizedFile.type,
                });
              if (uploadError) {
                console.error("Error subiendo imagen:", uploadError);
                continue;
              }
              const {
                data: { publicUrl },
              } = supabase.storage.from("vehicles").getPublicUrl(fileName);
              imageUrls.push(publicUrl);
            } catch (error) {
              console.error("Error procesando imagen:", error);
            }
          }
          if (imageUrls.length > 0) {
            patch.images = [...existingImages, ...imageUrls] as any;
          }
        }

        if (Object.keys(patch).length > 0) {
          await vehicleService.update(vehicleToEdit.id, patch);
        }

        toast({
          title: "Cambios guardados",
          description: "Fotos y precio del vehículo actualizados (se reflejan en la vitrina).",
        });
        setVehicleToEdit(null);
        setNewVehicle(createEmptyNewVehicle());
        await refetch();
        return;
      }

      // Calcular margen
      const margin = newVehicle.price - newVehicle.cost;
      const salePrice = Number(newVehicle.price || 0);
      const minDownPayment = minDownPaymentFromSalePrice(salePrice);
      const fuelDerived = deriveFuelTypeFromExcelText(newVehicle.combustible_display);
      const transDerived = deriveTransmissionFromExcelText(newVehicle.transmision_display);

      // Preparar features con campos adicionales
      const features = {
        drivetrain: newVehicle.drivetrain || null,
        min_down_payment: minDownPayment,
      };

      // Preparar datos de actualización
      const fallbackYear = new Date().getFullYear();
      const patenteVal = normalizePatente(newVehicle.patente) || null;
      const updateData = {
        vin: newVehicle.vin?.trim() || vehicleToEdit.vin,
        make: newVehicle.make.trim() || "Sin marca",
        model: newVehicle.model.trim() || "Sin modelo",
        year: newVehicle.year && Number(newVehicle.year) > 0 ? parseInt(String(newVehicle.year), 10) : fallbackYear,
        color: newVehicle.color.trim() || "Sin color",
        mileage: newVehicle.mileage ? Number(newVehicle.mileage) : null,
        fuel_type: fuelDerived,
        transmission: transDerived,
        engine_size: newVehicle.engine_size?.trim() || null,
        engine_number: newVehicle.engine_number?.trim() || null,
        category: "consignado" as const,
        owner_name: newVehicle.owner_name?.trim() || null,
        owner_phone: newVehicle.owner_phone?.trim() || null,
        consignment_type: newVehicle.consignment_type,
        patente: patenteVal,
        consignatario_staff_id: newVehicle.consignatario_staff_id.trim() || null,
        carroceria: newVehicle.carroceria?.trim() || null,
        transmision_display: newVehicle.transmision_display?.trim() || null,
        combustible_display: newVehicle.combustible_display?.trim() || null,
        publicado: newVehicle.publicado,
        price: Number(newVehicle.price || 0),
        cost: newVehicle.cost ? Number(newVehicle.cost) : null,
        margin: Number(margin),
        location: newVehicle.location?.trim() || null,
        features: features as any,
        status: newVehicle.status,
      };

      // Actualizar vehículo
      await vehicleService.update(vehicleToEdit.id, updateData);

      // Si hay nuevas imágenes, subirlas
      if (newVehicle.images.length > 0) {
        const imageUrls: string[] = [];
        const existingImages = (vehicleToEdit.images as unknown as string[] | null) || [];

        for (const file of newVehicle.images) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${vehicleToEdit.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            const optimizedFile = await optimizeVehicleImageForUpload(file);
            const { error: uploadError } = await supabase.storage
              .from('vehicles')
              .upload(fileName, optimizedFile, {
                cacheControl: '3600',
                upsert: false,
                contentType: optimizedFile.type,
              });

            if (uploadError) {
              console.error("❌ Error subiendo imagen:", uploadError);
              continue;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('vehicles')
              .getPublicUrl(fileName);

            imageUrls.push(publicUrl);
          } catch (error) {
            console.error("❌ Error procesando imagen:", error);
          }
        }

        // Actualizar vehículo con las nuevas URLs de las imágenes
        if (imageUrls.length > 0) {
          const allImages = [...existingImages, ...imageUrls];
          await vehicleService.update(vehicleToEdit.id, { images: allImages as any });
        }
      }

      // Cerrar diálogo y resetear
      setVehicleToEdit(null);
      setNewVehicle(createEmptyNewVehicle());

      // Refetch con timeout
      try {
        await Promise.race([
          refetch(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout en refetch')), 10000)
          )
        ]);
      } catch (refetchError) {
        console.warn("⚠️ Error o timeout en refetch:", refetchError);
        setTimeout(() => {
          refetch().catch(err => console.error("Error en refetch manual:", err));
        }, 1000);
      }
    } catch (error: any) {
      console.error("❌ Error actualizando vehículo:", error);
      console.error("Detalles del error:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      toast({ variant: "destructive", title: "Error al actualizar vehículo", description: error?.message || "Intentá de nuevo o pedí ayuda al admin." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete || !user) {
      setVehicleToDelete(null);
      setIsDeleting(false);
      return;
    }

    const vehicleToDeleteCopy = vehicleToDelete;

    // Cerrar el diálogo y limpiar estado inmediatamente
    setVehicleToDelete(null);
    setIsDeleting(true);

    // Usar requestAnimationFrame para asegurar que el DOM se actualice antes de la operación
    requestAnimationFrame(async () => {
      try {
        await vehicleService.delete(vehicleToDeleteCopy.id);
      } catch (error: any) {
        console.error("Error eliminando vehículo:", error);
      } finally {
        // Limpiar estado de loading
        setIsDeleting(false);

        // Refrescar la lista después de que todo se haya limpiado
        setTimeout(() => {
          refetch();
        }, 100);
      }
    });
  };

  const handleSellVehicle = async () => {
    if (!vehicleToSell || !user?.branch_id || !user?.tenant_id) {
      toast({ variant: "destructive", title: "Faltan datos", description: "No hay vehículo seleccionado, sucursal o tenant asignado." });
      return;
    }

    if (saleData.salePrice <= 0) {
      toast({ variant: "destructive", title: "Precio inválido", description: "Ingresá un precio de venta mayor a 0." });
      return;
    }

    setIsSaving(true);
    try {
      const margin = saleData.salePrice - Number(vehicleToSell.cost || 0);
      const commission = margin * 0.15;
      const vehicleDescription = [vehicleToSell.make, vehicleToSell.model, vehicleToSell.year]
        .filter(Boolean)
        .join(" ")
        .trim();

      await saleService.create({
        vehicle_id: vehicleToSell.id,
        seller_id: user.id,
        branch_id: user.branch_id,
        tenant_id: user.tenant_id,
        vehicle_description: vehicleDescription || null,
        sale_price: saleData.salePrice,
        down_payment: saleData.downPayment,
        financing_amount: saleData.salePrice - saleData.downPayment,
        margin,
        commission,
        status: "completada",
        payment_status: "realizado",
        sale_date: new Date().toISOString().split("T")[0],
        payment_method: saleData.paymentMethod,
        notes: saleData.notes || null,
        client_name: "PENDIENTE",
      });

      setVehicleToSell(null);
      setSaleData({
        salePrice: 0,
        downPayment: 0,
        paymentMethod: "contado",
        notes: "",
      });

      void queryClient.invalidateQueries({ queryKey: [DASHBOARD_STATS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["sales-ranking"] });

      setTimeout(() => {
        refetch();
      }, 100);

      toast({ title: "✅ Venta registrada", description: "La venta quedó guardada correctamente." });
    } catch (error: unknown) {
      console.error("❌ Error registrando venta:", error);
      toast({
        variant: "destructive",
        title: "Error al registrar venta",
        description: error instanceof Error ? error.message : "Intentá de nuevo o pedí ayuda al admin.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const buildExportRows = (vehiclesToExport: Vehicle[], detail: "basic" | "full") => {
    if (detail === "basic") {
      return vehiclesToExport.map((vehicle) => ({
        Marca: vehicle.make || "",
        Modelo: vehicle.model || "",
        Año: vehicle.year || "",
        Estado: statusLabels[vehicle.status] || vehicle.status || "",
        Consignación: consignmentTypeLabels[getVehicleConsignmentType(vehicle)],
        "Dueño": vehicle.owner_name || "",
        Teléfono: vehicle.owner_phone || "",
        Precio: Number(vehicle.price || 0),
      }));
    }

    return vehiclesToExport.map((vehicle) => ({
      ID: vehicle.id,
      Marca: vehicle.make || "",
      Modelo: vehicle.model || "",
      Año: vehicle.year || "",
      Color: vehicle.color || "",
      Kilometraje: vehicle.mileage ?? "",
      Consignación: consignmentTypeLabels[getVehicleConsignmentType(vehicle)],
      "Dueño": vehicle.owner_name || "",
      Teléfono: vehicle.owner_phone || "",
      Estado: statusLabels[vehicle.status] || vehicle.status || "",
      Precio: Number(vehicle.price || 0),
      Costo: Number(vehicle.cost || 0),
      Margen: Number(vehicle.margin || 0),
      Combustible: vehicle.fuel_type || "",
      Transmisión: vehicle.transmission || "",
      Motor: vehicle.engine_size || "",
      Ubicación: vehicle.location || "",
      Sucursal: (vehicle as any)?.branches?.name || "",
      "Fecha llegada": vehicle.arrival_date
        ? new Date(vehicle.arrival_date).toLocaleDateString("es-CL")
        : "",
      Creado: vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString("es-CL") : "",
      Actualizado: vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleDateString("es-CL") : "",
    }));
  };

  const getSanitizedFileName = () => {
    const base = exportFileName
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "inventario";
    const ext = exportFormat === "csv" ? "csv" : exportFormat === "pdf" ? "pdf" : "xlsx";
    return `${base}.${ext}`;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportInventory = async () => {
    if (!user?.branch_id) {
      toast({ variant: "destructive", title: "Sin sucursal asignada", description: "Contactá al administrador para que te asigne una sucursal." });
      return;
    }

    setIsExporting(true);
    try {
      const vehiclesToExport =
        exportScope === "filtered"
          ? filteredVehicles
          : await vehicleService.getAll({ branchId: user.branch_id });

      if (vehiclesToExport.length === 0) {
        toast({ title: "Sin vehículos", description: "No hay vehículos para exportar con los filtros actuales." });
        return;
      }

      const rows = buildExportRows(vehiclesToExport, exportDetail);
      const fileName = getSanitizedFileName();

      if (exportFormat === "csv") {
        const headers = Object.keys(rows[0] || {});
        const escapeCsv = (val: unknown): string => {
          const s = String(val ?? "");
          if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };
        const headerLine = headers.map(escapeCsv).join(",");
        const dataLines = rows.map((r) => headers.map((h) => escapeCsv((r as Record<string, unknown>)[h])).join(","));
        const csv = [headerLine, ...dataLines].join("\r\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, fileName);
      } else if (exportFormat === "pdf") {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const headers = Object.keys(rows[0] || {});
        const body = rows.map((r) => headers.map((h) => String((r as Record<string, unknown>)[h] ?? "")));
        autoTable(doc, {
          head: [headers],
          body,
          styles: { fontSize: 7 },
          margin: { top: 10 },
        });
        doc.save(fileName);
      } else {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Consignaciones");
        const workbookArray = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "array",
          compression: true,
        });
        const blob = new Blob([workbookArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        if (blob.size === 0) throw new Error("El archivo XLSX quedó vacío.");
        downloadBlob(blob, fileName);
      }

      setShowExportDialog(false);
    } catch (error) {
      console.error("Error exportando:", error);
      toast({ variant: "destructive", title: "Error al exportar", description: "No se pudo generar el archivo. Intentá de nuevo." });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">
            Gestiona consignaciones físicas y digitales en un solo lugar
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!hidesCosts && (
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(true)}
              disabled={isExporting || !user?.branch_id}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exportando..." : "Exportar"}
            </Button>
          )}
          {canAddInventoryVehicle(user?.role) && (
            <Button
              onClick={() => {
                setNewVehicle(createEmptyNewVehicle());
                setShowAddDialog(true);
              }}
              className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Vehículo
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca, modelo, VIN, PPU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(statusLabels).map(([key]) => (
              <SelectItem key={key} value={key}>
                <VehicleStatusLabel statusKey={key} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Consignación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {(Object.entries(consignmentTypeLabels) as [ConsignmentType, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMake} onValueChange={setSelectedMake}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las marcas</SelectItem>
            {uniqueMakes.map((make) => (
              <SelectItem key={make} value={make}>{make}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={`grid gap-4 ${hidesCosts ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total Vehículos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredVehicles.length}</div>
            <p className="text-xs text-muted-foreground">
              de {vehicles.length} en stock
            </p>
          </CardContent>
        </Card>

        {!hidesCosts && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Valor Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCLP(totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                precio de lista
              </p>
            </CardContent>
          </Card>
        )}

        {!hidesCosts && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Margen Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCLP(totalMargin)}</div>
              <p className="text-xs text-muted-foreground">
                margen proyectado
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Publicados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {filteredVehicles.filter(v => v.status === 'disponible').length}
            </div>
            <p className="text-xs text-muted-foreground">
              en portales activos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vehicles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Vehículos en Stock
            {isFetching && !loading && vehicles.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">Actualizando...</span>
            )}
          </CardTitle>
          <CardDescription>
            {filteredVehicles.length} vehículo{filteredVehicles.length !== 1 ? 's' : ''} encontrado{filteredVehicles.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Detalles</TableHead>
                {showPrice && <TableHead>Precio</TableHead>}
                {!hidesCosts && <TableHead>Margen</TableHead>}
                <TableHead>Estado</TableHead>
                <TableHead>Consignación</TableHead>
                <TableHead className="w-[140px]">Portales</TableHead>
                {showInventoryActions && (
                  <TableHead className="w-[100px]">
                    {isPhotographer ? "Fotos" : "Acciones"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !vehiclesError && (
                <TableRow>
                  <TableCell colSpan={inventoryTableColSpan} className="text-center py-8 text-muted-foreground">
                    Cargando vehículos...
                  </TableCell>
                </TableRow>
              )}
              {vehiclesError && (
                <TableRow>
                  <TableCell colSpan={inventoryTableColSpan} className="text-center py-8">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <p>No se pudo cargar el inventario. {vehiclesError.message || "Error de conexión."}</p>
                      <Button variant="outline" size="sm" onClick={() => refetch()}>
                        Reintentar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && !vehiclesError && pagedVehicles.map((vehicle) => (
                <TableRow
                  key={vehicle.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedVehicle(vehicle)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <VehicleImage
                          src={firstVehicleImageUrl(vehicle.images)}
                          alt={`${vehicle.make} ${vehicle.model}`}
                          preset="thumb-xs"
                          className="h-full w-full object-cover"
                          displayWidth={48}
                          displayHeight={48}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {formatVehicleLabel(vehicle.make)} {formatVehicleLabel(vehicle.model)}
                        </div>
                        <div className="text-sm text-muted-foreground">{vehicle.engine_size || ""}</div>
                      </div>
                      {!isPhotographer && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8"
                          title="Ver leads que buscan este modelo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLeadsMatchVehicle(vehicle);
                          }}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">{vehicle.year}</span> • {vehicle.color}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        VIN: {vehicle.vin} • {(vehicle.mileage || 0).toLocaleString()} km
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {vehicle.transmission} • {vehicle.fuel_type || "—"}
                      </div>
                      {vehicle.arrival_date && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {(() => {
                            const arrivalDate = new Date(vehicle.arrival_date);
                            const daysDiff = Math.floor((Date.now() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
                            if (daysDiff === 0) return "Llegó hoy";
                            if (daysDiff === 1) return "Llegó hace 1 día";
                            if (daysDiff < 30) return `Llegó hace ${daysDiff} días`;
                            const months = Math.floor(daysDiff / 30);
                            if (months === 1) return "Llegó hace 1 mes";
                            if (months < 12) return `Llegó hace ${months} meses`;
                            const years = Math.floor(months / 12);
                            return years === 1 ? "Llegó hace 1 año" : `Llegó hace ${years} años`;
                          })()}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {showPrice && (
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{formatCLP(Number(vehicle.price || 0))}</div>
                        {!hidesCosts && (
                          <div className="text-sm text-muted-foreground">
                            Costo: {formatCLP(Number(vehicle.cost || 0))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {!hidesCosts && (
                    <TableCell>
                      <div className={`font-medium ${(Number(vehicle.margin || 0)) > 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCLP(Number(vehicle.margin || 0))}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Number(vehicle.price || 0) > 0 ? ((Number(vehicle.margin || 0)) / Number(vehicle.price || 0) * 100).toFixed(1) : "0.0"}%
                      </div>
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <VehicleStatusPicker
                      status={vehicle.status}
                      disabled={isPhotographer}
                      isUpdating={statusUpdatingVehicleId === vehicle.id}
                      onStatusChange={(next) => handleVehicleStatusChange(vehicle, next)}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col gap-1.5">
                      <Badge variant="secondary" className="w-fit">
                        {consignmentTypeLabels[getVehicleConsignmentType(vehicle)]}
                      </Badge>
                      {(() => {
                        const vdocs = documentsByVehicle[vehicle.id] ?? [];
                        const consigDoc = vdocs.find((d) => d.type === "contrato_consignacion");
                        const ventaDoc = vdocs.find((d) => d.type === "contrato_venta");
                        return (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              title={
                                consigDoc
                                  ? `Contrato de consignación ${consigDoc.document_number} — abrir / imprimir`
                                  : "Generar contrato de consignación"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/app/documents/vehiculo/${vehicle.id}?tipo=consignacion`);
                              }}
                            >
                              <FileText className="h-3.5 w-3.5 text-pink-600" />
                              {consigDoc ? (
                                <span className="font-medium text-emerald-600">✓ Consig.</span>
                              ) : (
                                <span className="text-muted-foreground">Consig.</span>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              title={
                                ventaDoc
                                  ? `Nota de venta ${ventaDoc.document_number} — abrir / imprimir`
                                  : "Generar nota de venta"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/app/documents/vehiculo/${vehicle.id}?tipo=venta`);
                              }}
                            >
                              <ScrollText className="h-3.5 w-3.5 text-emerald-600" />
                              {ventaDoc ? (
                                <span className="font-medium text-emerald-600">✓ Venta</span>
                              ) : (
                                <span className="text-muted-foreground">Venta</span>
                              )}
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(listingsByVehicle[vehicle.id] ?? []).map((l) => (
                        <Badge
                          key={l.id}
                          variant={l.status === "published" ? "default" : l.status === "error" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {l.platform === "mercadolibre" ? "ML" : l.platform === "facebook" ? "FB" : "Chile"}
                          {l.status === "published" ? " ✓" : l.status === "error" ? " ✗" : ""}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  {isPhotographer && (
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Subir o editar fotos"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSaving(true);
                          vehicleService
                            .getById(vehicle.id)
                            .then((full) => setVehicleToEdit(full as any))
                            .finally(() => setIsSaving(false));
                        }}
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Fotos
                      </Button>
                    </TableCell>
                  )}
                  {!hidesCosts && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver detalles"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVehicle(vehicle);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSaving(true);
                          vehicleService.getById(vehicle.id)
                            .then((full) => setVehicleToEdit(full as any))
                            .finally(() => setIsSaving(false));
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DropdownMenu onOpenChange={(open) => {
                        // Asegurar que el menú se cierre correctamente
                        if (!open) {
                          // Pequeño delay para asegurar que el estado se actualice
                          setTimeout(() => {
                            // Forzar actualización del DOM
                            requestAnimationFrame(() => {});
                          }, 0);
                        }
                      }}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onCloseAutoFocus={(e) => {
                            e.preventDefault();
                          }}
                        >
                          {vehicle.status === 'ingreso' && (
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Publicar
                            </DropdownMenuItem>
                          )}
                          {vehicle.status === 'disponible' && (
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Pausar publicación
                            </DropdownMenuItem>
                          )}
                          {marketplaceConnections.some((c) => c.platform === "mercadolibre") && vehicle.status === "disponible" && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePublishToPlatform(vehicle.id, "mercadolibre");
                              }}
                              disabled={publishingKey === `${vehicle.id}:mercadolibre`}
                            >
                              {publishingKey === `${vehicle.id}:mercadolibre` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Globe className="h-4 w-4 mr-2" />
                              )}
                              Publicar en Mercado Libre
                            </DropdownMenuItem>
                          )}
                          {marketplaceConnections.some((c) => c.platform === "facebook") && vehicle.status === "disponible" && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePublishToPlatform(vehicle.id, "facebook");
                              }}
                              disabled={publishingKey === `${vehicle.id}:facebook`}
                            >
                              {publishingKey === `${vehicle.id}:facebook` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Globe className="h-4 w-4 mr-2" />
                              )}
                              Publicar en Facebook
                            </DropdownMenuItem>
                          )}
                          {marketplaceConnections.some((c) => c.platform === "chileautos") && vehicle.status === "disponible" && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePublishToPlatform(vehicle.id, "chileautos");
                              }}
                              disabled={publishingKey === `${vehicle.id}:chileautos`}
                            >
                              {publishingKey === `${vehicle.id}:chileautos` ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Globe className="h-4 w-4 mr-2" />
                              )}
                              Publicar en Chile Autos
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setLeadsMatchVehicle(vehicle);
                            }}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Leads que buscan este modelo
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            Ajustar precio
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            Reservar para lead
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setVehicleToSell(vehicle);
                              setSaleData({
                                salePrice: Number(vehicle.price || 0),
                                downPayment: 0,
                                paymentMethod: 'contado',
                                notes: ''
                              });
                            }}
                          >
                            Marcar como vendido
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                            onSelect={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setVehicleToDelete(vehicle);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Borrar vehículo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!loading && !vehiclesError && filteredVehicles.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {isFilterActive
                  ? "No se encontraron vehículos con los filtros aplicados."
                  : "Aún no hay vehículos en inventario."}
              </p>
            </div>
          )}

          {!loading && !vehiclesError && filteredVehicles.length > 0 && (
            <PaginationControls
              page={vehiclesPage}
              totalPages={vehiclesTotalPages}
              pageSize={vehiclesPageSize}
              totalItems={vehiclesTotalItems}
              onPageChange={setVehiclesPage}
              onPageSizeChange={setVehiclesPageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialog de exportación */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Exportar</DialogTitle>
            <DialogDescription>
              Elige el formato, alcance y nivel de detalle del archivo a exportar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="export-file-name">Nombre del archivo</Label>
              <Input
                id="export-file-name"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder="Ej: inventario_febrero"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Formato</div>
              <RadioGroup
                value={exportFormat}
                onValueChange={(value) => setExportFormat(value as "csv" | "xlsx" | "pdf")}
                className="flex flex-wrap gap-4"
              >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="csv" />
                  CSV
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="xlsx" />
                  XLSX (Excel)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="pdf" />
                  PDF
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Alcance</div>
              <RadioGroup
                value={exportScope}
                onValueChange={(value) => setExportScope(value as "all" | "filtered")}
                className="gap-3"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="all" />
                  Todo el inventario
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="filtered" />
                  Solo con filtros actuales
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Nivel de detalle</div>
              <RadioGroup
                value={exportDetail}
                onValueChange={(value) => setExportDetail(value as "basic" | "full")}
                className="gap-3"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="basic" />
                  Básico (marca, modelo, año, estado, tipo, precio)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="full" />
                  Completo (incluye costos, margen, fechas y ubicación)
                </label>
              </RadioGroup>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowExportDialog(false)} disabled={isExporting}>
              Cancelar
            </Button>
            <Button onClick={handleExportInventory} disabled={isExporting}>
              {isExporting ? "Exportando..." : `Exportar ${exportFormat.toUpperCase()}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle Vehículo */}
      <Dialog
        open={!!selectedVehicle}
        onOpenChange={(open) => {
          if (!open) closeVehicleDetailModal();
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle del Vehículo</DialogTitle>
            <DialogDescription>
              Información completa del vehículo seleccionado
            </DialogDescription>
          </DialogHeader>

          {selectedVehicle && selectedVehicleComputed && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {selectedVehicleLoading && (
                <div className="lg:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando detalle completo...
                </div>
              )}
              {/* Fotos */}
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border bg-muted">
                  <VehicleImage
                    src={firstVehicleImageUrl((selectedVehicleFull || selectedVehicle).images)}
                    alt="Foto vehículo"
                    preset="hero"
                    className="w-full h-[280px] object-cover"
                    displayHeight={280}
                  />
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(() => {
                    const raw = ((selectedVehicleFull || selectedVehicle).images as unknown as string[] | null) ?? [];
                    const base = raw.length ? raw : [PLACEHOLDER_VEHICLE_IMAGE];
                    return base.slice(0, 5).map((src, idx) => (
                      <button
                        key={`${src}-${idx}`}
                        type="button"
                        className="rounded-lg overflow-hidden border bg-muted hover:opacity-90"
                        onClick={() => {
                          const full = ((selectedVehicleFull || selectedVehicle).images as unknown as string[] | null) ?? [];
                          const list = full.length ? [...full] : [PLACEHOLDER_VEHICLE_IMAGE];
                          const next = [...list];
                          const picked = next[idx];
                          next.splice(idx, 1);
                          next.unshift(picked);
                          const baseVeh = selectedVehicleFull || selectedVehicle;
                          setSelectedVehicle({ ...selectedVehicle, images: next as any });
                          if (selectedVehicleFull && baseVeh?.id === selectedVehicleFull.id) {
                            setSelectedVehicleFull({ ...selectedVehicleFull, images: next as any });
                          }
                        }}
                      >
                        <VehicleImage
                          src={src}
                          alt="thumb"
                          preset="thumb-sm"
                          className="h-14 w-full object-cover"
                          displayHeight={56}
                        />
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* Ficha */}
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {(selectedVehicleFull || selectedVehicle).make} {(selectedVehicleFull || selectedVehicle).model} {(selectedVehicleFull || selectedVehicle).year}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {(selectedVehicleFull || selectedVehicle).engine_size || ""}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground mb-1.5">Estado</div>
                    <VehicleStatusPicker
                      status={(selectedVehicleFull || selectedVehicle).status}
                      disabled={isPhotographer}
                      isUpdating={
                        statusUpdatingVehicleId === (selectedVehicleFull || selectedVehicle).id
                      }
                      onStatusChange={(next) =>
                        handleVehicleStatusChange(selectedVehicleFull || selectedVehicle, next)
                      }
                    />
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Consignación</div>
                    <div className="font-semibold">{selectedVehicleComputed.consignmentLabel}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Dueño</div>
                    <div className="font-semibold">{selectedVehicleComputed.ownerName}</div>
                  </div>
                  <div className="rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Teléfono dueño</div>
                    <div className="font-semibold">{selectedVehicleComputed.ownerPhone}</div>
                  </div>
                  {showPrice && (
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">Valor por vender</div>
                      <div className="font-semibold">{formatCLP(Number(selectedVehicle.price || 0))}</div>
                    </div>
                  )}
                  {!hidesCosts && (
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">Pie mínimo</div>
                      <div className="font-semibold">{formatCLP(selectedVehicleComputed.minDownPayment)}</div>
                    </div>
                  )}
                </div>

                <VehicleConsignacionPanel
                  vehicleId={(selectedVehicleFull || selectedVehicle).id}
                  patente={(selectedVehicleFull || selectedVehicle).patente}
                  branchId={user?.branch_id ?? undefined}
                  inventoryConsignment={{
                    owner_name: (selectedVehicleFull || selectedVehicle).owner_name,
                    owner_phone: (selectedVehicleFull || selectedVehicle).owner_phone,
                    price: Number((selectedVehicleFull || selectedVehicle).price ?? 0),
                    consignment_type: getVehicleConsignmentType(
                      selectedVehicleFull || selectedVehicle
                    ),
                    min_down_payment: selectedVehicleComputed?.minDownPayment ?? null,
                  }}
                />

                <div className="rounded-xl border p-4">
                  <div className="font-semibold mb-3">Características</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Kilometraje y año</div>
                      <div className="font-medium">
                          {(((selectedVehicleFull || selectedVehicle).mileage || 0) as number).toLocaleString()} km · {(selectedVehicleFull || selectedVehicle).year}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Motor</div>
                      <div className="font-medium">{selectedVehicleComputed.engine}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Tipo combustible</div>
                        <div className="font-medium">{(selectedVehicleFull || selectedVehicle).fuel_type || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Tracción</div>
                      <div className="font-medium">{selectedVehicleComputed.drivetrain}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Ubicación física</div>
                      <div className="font-medium">{selectedVehicleComputed.location}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Transmisión</div>
                      <div className="font-medium">{(selectedVehicleFull || selectedVehicle).transmission}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Capacidad de cajuela (L)</div>
                      <div className="font-medium">{selectedVehicleComputed.trunkCapacityLiters}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Techo corredizo</div>
                      <div className="font-medium">{selectedVehicleComputed.sunroof}</div>
                    </div>
                    {(selectedVehicleFull || selectedVehicle).arrival_date && (
                      <div>
                        <div className="text-xs text-muted-foreground">Fecha de llegada</div>
                        <div className="font-medium">
                          {(() => {
                            const arrivalDate = new Date((selectedVehicleFull || selectedVehicle).arrival_date as string);
                            const formattedDate = arrivalDate.toLocaleDateString('es-CL', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });
                            const daysDiff = Math.floor((Date.now() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24));
                            let timeText = "";
                            if (daysDiff === 0) timeText = " (Llegó hoy)";
                            else if (daysDiff === 1) timeText = " (Llegó hace 1 día)";
                            else if (daysDiff < 30) timeText = ` (Llegó hace ${daysDiff} días)`;
                            else {
                              const months = Math.floor(daysDiff / 30);
                              if (months === 1) timeText = " (Llegó hace 1 mes)";
                              else if (months < 12) timeText = ` (Llegó hace ${months} meses)`;
                              else {
                                const years = Math.floor(months / 12);
                                timeText = years === 1 ? " (Llegó hace 1 año)" : ` (Llegó hace ${years} años)`;
                              }
                            }
                            return `${formattedDate}${timeText}`;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedVehicle && (
            <DialogFooter className="flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              {!isPhotographer && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setLeadsMatchVehicle(selectedVehicleFull || selectedVehicle)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Leads que buscan este modelo
                </Button>
              )}
              <Button
                type="button"
                disabled={isSaving}
                className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                onClick={() => openVehicleEditor(selectedVehicleFull || selectedVehicle)}
              >
                {isPhotographer ? (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Editar fotos
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar vehículo
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!leadsMatchVehicle}
        onOpenChange={(open) => {
          if (!open) setLeadsMatchVehicle(null);
        }}
      >
        <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Leads interesados</DialogTitle>
            <DialogDescription className="sr-only">
              Lista de leads del CRM que pueden corresponder a este vehículo según preferencias o interés declarado.
            </DialogDescription>
            {leadsMatchVehicle && (
              <p className="text-sm text-muted-foreground pt-1">
                Coincidencias para{" "}
                <span className="font-medium text-foreground">
                  {leadsMatchVehicle.make} {leadsMatchVehicle.model} ({leadsMatchVehicle.year})
                </span>
                : vehículo preferido en CRM, marca declarada o texto de interés/preferencia/notas.
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {matchingLeadsLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando leads…
              </div>
            )}

            {!matchingLeadsLoading && matchingLeadsError && (
              <p className="text-sm text-destructive">
                {matchingLeadsError instanceof Error ? matchingLeadsError.message : "No se pudieron cargar los leads."}
              </p>
            )}

            {!matchingLeadsLoading && !matchingLeadsError && matchingLeadsSorted.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No hay leads que coincidan con los criterios actuales{user?.branch_id ? " de tu sucursal" : ""}. En el CRM
                puedes vincular este auto como preferido o completar marca e interés del cliente.
              </p>
            )}

            {!matchingLeadsLoading && !matchingLeadsError && matchingLeadsSorted.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground">
                  {matchingLeadsSorted.length} resultado{matchingLeadsSorted.length !== 1 ? "s" : ""} (activos y con
                  vehículo preferido primero).
                </p>
                <div className="border rounded-md overflow-auto flex-1 min-h-[200px] max-h-[52vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Interés / vehículo</TableHead>
                        <TableHead>Asignado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchingLeadsSorted.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium max-w-[140px] truncate" title={lead.full_name}>
                            {lead.full_name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{lead.phone}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">
                              {LEAD_STATUS_LABELS_ES[(lead.status || "").toLowerCase()] ||
                                lead.status ||
                                "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                            <span className="line-clamp-2" title={lead.vehicle_interest || ""}>
                              {lead.preferred_vehicle_id === leadsMatchVehicle?.id && (
                                <Badge variant="secondary" className="mr-1 text-[10px] px-1">
                                  Preferido
                                </Badge>
                              )}
                              {truncateSnippet(
                                lead.vehicle_interest ||
                                  lead.preferencia ||
                                  lead.marca_preferida ||
                                  lead.notes,
                                120
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                            {(lead as LeadWithAssignee).assigned_user?.full_name || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t shrink-0">
            <Button type="button" variant="outline" onClick={() => setLeadsMatchVehicle(null)}>
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setLeadsMatchVehicle(null);
                navigate("/app/crm");
              }}
            >
              Abrir CRM
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para agregar vehículo */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) {
            if (location.search) {
              navigate(location.pathname, { replace: true });
            }
            setNewVehicle(createEmptyNewVehicle());
            setVehicleFormRevealed(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Vehículo</DialogTitle>
            <DialogDescription>
              Completa todos los campos para agregar un vehículo al inventario
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Buscar por patente: autorrellena los datos desde GetAPI */}
            <div className="rounded-lg border bg-muted/40 p-4">
              <Label htmlFor="patente-lookup" className="text-sm font-medium">Buscar por patente</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Ingresá la patente y traemos marca, modelo, versión, año, color, kilometraje, carrocería, puertas, N° de motor, VIN/N° de chasis, transmisión y combustible automáticamente. Después revisás y completás lo que falte.
              </p>
              <div className="flex gap-2">
                <Input
                  id="patente-lookup"
                  value={newVehicle.patente}
                  onChange={(e) => setNewVehicle({ ...newVehicle, patente: formatPatente(e.target.value) })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleBuscarPatente();
                    }
                  }}
                  placeholder="AB-CD-12"
                  maxLength={8}
                  className="uppercase"
                  disabled={patenteLookupLoading}
                />
                <Button type="button" onClick={handleBuscarPatente} disabled={patenteLookupLoading}>
                  {patenteLookupLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Buscando…
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Buscar
                    </>
                  )}
                </Button>
              </div>
              {!vehicleFormRevealed && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline mt-2"
                  onClick={() => setVehicleFormRevealed(true)}
                >
                  Completar manualmente sin patente
                </button>
              )}
            </div>

            {vehicleFormRevealed && (
            <>
            <div>
              <Label htmlFor="images">Fotos del vehículo</Label>
              <div className="mt-2">
                <div className="flex flex-wrap gap-4 mb-4">
                  {newVehicle.images.map((file, index) => {
                    return (
                      <div key={index} className="relative">
                        <LocalFilePreview
                          file={file}
                          alt={`Vehículo ${index + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border bg-muted"
                          displayWidth={96}
                          displayHeight={96}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="make">Marca</Label>
                <Input
                  id="make"
                  value={newVehicle.make}
                  onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                  placeholder="Ej: Toyota"
                />
              </div>
              <div>
                <Label htmlFor="model">{STOCK_ONLINE_COLUMN_LABELS.modelo}</Label>
                <Input
                  id="model"
                  value={newVehicle.model}
                  onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  placeholder="Ej: Corolla Cross"
                />
              </div>
              <div>
                <Label htmlFor="year">{STOCK_ONLINE_COLUMN_LABELS.anio}</Label>
                <Input
                  id="year"
                  type="text"
                  value={newVehicle.year || ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (value === "") {
                      setNewVehicle({ ...newVehicle, year: 0 });
                    } else {
                      const yearNum = parseInt(value, 10);
                      if (!isNaN(yearNum)) {
                        setNewVehicle({ ...newVehicle, year: yearNum });
                      }
                    }
                  }}
                  placeholder="Ej: 2024"
                />
              </div>
              <div>
                <Label htmlFor="carroceria">{STOCK_ONLINE_COLUMN_LABELS.carroceria}</Label>
                <Select
                  value={newVehicle.carroceria || undefined}
                  onValueChange={(value) => setNewVehicle({ ...newVehicle, carroceria: value })}
                >
                  <SelectTrigger id="carroceria">
                    <SelectValue placeholder="Seleccionar carrocería" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CARROCERIA_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                    {legacySelectItem(newVehicle.carroceria, INVENTORY_CARROCERIA_OPTIONS)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="mileage">{STOCK_ONLINE_COLUMN_LABELS.kilometraje}</Label>
                <Input
                  id="mileage"
                  type="text"
                  value={formatNumberDisplay(newVehicle.mileage)}
                  onChange={(e) => {
                    try {
                      const formatted = formatNumberInput(e.target.value);
                      setNewVehicle({ ...newVehicle, mileage: parseNumberInput(formatted) });
                    } catch (error) {
                      console.error("Error procesando kilometraje:", error);
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData("text");
                    const formatted = formatNumberInput(pastedText);
                    setNewVehicle({ ...newVehicle, mileage: parseNumberInput(formatted) });
                  }}
                  placeholder="Ej: 15.000"
                />
              </div>
              <div>
                <Label htmlFor="engine_size">{STOCK_ONLINE_COLUMN_LABELS.motor}</Label>
                <Input
                  id="engine_size"
                  value={newVehicle.engine_size}
                  onChange={(e) => setNewVehicle({ ...newVehicle, engine_size: e.target.value })}
                  placeholder="Ej: 2.0, 1600 cc"
                />
              </div>
              <div>
                <Label htmlFor="engine_number">N° de motor</Label>
                <Input
                  id="engine_number"
                  value={newVehicle.engine_number}
                  onChange={(e) => setNewVehicle({ ...newVehicle, engine_number: e.target.value })}
                  placeholder="N° de motor (desde patente)"
                />
              </div>
              <div>
                <Label htmlFor="vin">N° de chasis / VIN</Label>
                <Input
                  id="vin"
                  value={newVehicle.vin}
                  onChange={(e) => setNewVehicle({ ...newVehicle, vin: e.target.value })}
                  placeholder="N° de chasis / VIN (desde patente)"
                />
              </div>
              <div>
                <Label htmlFor="version">Versión</Label>
                <Input
                  id="version"
                  value={newVehicle.version}
                  onChange={(e) => setNewVehicle({ ...newVehicle, version: e.target.value })}
                  placeholder="Ej: Limited, Full, XLT"
                />
              </div>
              <div>
                <Label htmlFor="doors">Puertas</Label>
                <Input
                  id="doors"
                  type="text"
                  value={newVehicle.doors || ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    setNewVehicle({ ...newVehicle, doors: v === "" ? 0 : parseInt(v, 10) });
                  }}
                  placeholder="Ej: 4"
                />
              </div>
              <div>
                <Label htmlFor="transmision_display">{STOCK_ONLINE_COLUMN_LABELS.transmision}</Label>
                <Select
                  value={newVehicle.transmision_display || undefined}
                  onValueChange={(value) => {
                    const match = INVENTORY_TRANSMISION_OPTIONS.find((o) => o.value === value);
                    setNewVehicle({
                      ...newVehicle,
                      transmision_display: value,
                      transmission:
                        match?.transmission ?? deriveTransmissionFromExcelText(value),
                    });
                  }}
                >
                  <SelectTrigger id="transmision_display">
                    <SelectValue placeholder="Seleccionar transmisión" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_TRANSMISION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.value}
                      </SelectItem>
                    ))}
                    {legacySelectItem(
                      newVehicle.transmision_display,
                      INVENTORY_TRANSMISION_OPTIONS.map((o) => o.value),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="combustible_display">{STOCK_ONLINE_COLUMN_LABELS.combustible}</Label>
                <Select
                  value={newVehicle.combustible_display || undefined}
                  onValueChange={(value) => {
                    const match = INVENTORY_COMBUSTIBLE_OPTIONS.find((o) => o.value === value);
                    setNewVehicle({
                      ...newVehicle,
                      combustible_display: value,
                      fuel_type: match?.fuel_type ?? deriveFuelTypeFromExcelText(value),
                    });
                  }}
                >
                  <SelectTrigger id="combustible_display">
                    <SelectValue placeholder="Seleccionar combustible" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_COMBUSTIBLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.value}
                      </SelectItem>
                    ))}
                    {legacySelectItem(
                      newVehicle.combustible_display,
                      INVENTORY_COMBUSTIBLE_OPTIONS.map((o) => o.value),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="patente">{STOCK_ONLINE_COLUMN_LABELS.patente}</Label>
                <Input
                  id="patente"
                  value={newVehicle.patente}
                  onChange={(e) => setNewVehicle({ ...newVehicle, patente: formatPatente(e.target.value) })}
                  placeholder="Ej: AB-CD-12"
                  maxLength={8}
                />
              </div>
              <div>
                <Label htmlFor="price">{STOCK_ONLINE_COLUMN_LABELS.precio} (CLP)</Label>
                <Input
                  id="price"
                  type="text"
                  value={formatNumberDisplay(newVehicle.price)}
                  onChange={(e) => {
                    try {
                      const formatted = formatNumberInput(e.target.value);
                      setNewVehicle(patchVehicleSalePrice(newVehicle, parseNumberInput(formatted)));
                    } catch (error) {
                      console.error("Error procesando precio:", error);
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData("text");
                    const formatted = formatNumberInput(pastedText);
                    setNewVehicle(patchVehicleSalePrice(newVehicle, parseNumberInput(formatted)));
                  }}
                  placeholder="Ej: 15.990.000"
                />
              </div>
              <div>
                <Label htmlFor="consignatario_staff_id">{STOCK_ONLINE_COLUMN_LABELS.consignatario}</Label>
                <Select
                  value={newVehicle.consignatario_staff_id || "__none__"}
                  onValueChange={(v) =>
                    setNewVehicle({
                      ...newVehicle,
                      consignatario_staff_id: v === "__none__" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger id="consignatario_staff_id">
                    <SelectValue placeholder="Seleccionar vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {salesStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                        {s.role_label ? ` · ${s.role_label}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={newVehicle.color}
                  onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                  placeholder="Ej: Blanco"
                />
              </div>
              <div>
                <Label htmlFor="owner_name">Nombre del dueño</Label>
                <Input
                  id="owner_name"
                  value={newVehicle.owner_name}
                  onChange={(e) => setNewVehicle({ ...newVehicle, owner_name: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div>
                <Label htmlFor="owner_phone">Teléfono del dueño</Label>
                <Input
                  id="owner_phone"
                  type="tel"
                  value={newVehicle.owner_phone}
                  onChange={(e) => setNewVehicle({ ...newVehicle, owner_phone: e.target.value })}
                  placeholder="Ej: +56 9 1234 5678"
                />
              </div>
              <div>
                <Label htmlFor="consignment_type">Tipo de consignación</Label>
                <Select
                  value={newVehicle.consignment_type}
                  onValueChange={(value: ConsignmentType) =>
                    setNewVehicle({ ...newVehicle, consignment_type: value })
                  }
                >
                  <SelectTrigger id="consignment_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisica">Física</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cost">Costo (CLP)</Label>
                <Input
                  id="cost"
                  type="text"
                  value={formatNumberDisplay(newVehicle.cost)}
                  onChange={(e) => {
                    try {
                      const formatted = formatNumberInput(e.target.value);
                      setNewVehicle({ ...newVehicle, cost: parseNumberInput(formatted) });
                    } catch (error) {
                      console.error("Error procesando costo:", error);
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData("text");
                    const formatted = formatNumberInput(pastedText);
                    setNewVehicle({ ...newVehicle, cost: parseNumberInput(formatted) });
                  }}
                  placeholder="Ej: 12.000.000"
                />
              </div>
              <div>
                <Label htmlFor="minDownPayment">Pie mínimo (30% del precio)</Label>
                <Input
                  id="minDownPayment"
                  type="text"
                  readOnly
                  value={formatNumberDisplay(newVehicle.minDownPayment)}
                  className="bg-muted/60 cursor-default"
                  placeholder="Se calcula al ingresar el precio"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculado automáticamente: 30% del precio de venta.
                </p>
              </div>
              <div>
                <Label htmlFor="drivetrain">Tracción</Label>
                <Select
                  value={newVehicle.drivetrain || undefined}
                  onValueChange={(value) => setNewVehicle({ ...newVehicle, drivetrain: value })}
                >
                  <SelectTrigger id="drivetrain">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Delantera">Delantera</SelectItem>
                    <SelectItem value="Trasera">Trasera</SelectItem>
                    <SelectItem value="4WD">4WD (Tracción en las 4 ruedas)</SelectItem>
                    <SelectItem value="AWD">AWD (Tracción integral)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="location">Ubicación física</Label>
                <Input
                  id="location"
                  value={newVehicle.location}
                  onChange={(e) => setNewVehicle({ ...newVehicle, location: e.target.value })}
                  placeholder="Ej: Patio A, Estacionamiento 3"
                />
              </div>
            </div>

            <VehicleFormPublicationFooter
              publicado={newVehicle.publicado}
              onPublicadoChange={(checked) => setNewVehicle({ ...newVehicle, publicado: checked })}
              publishSwitchId="publicado_add"
              onCancel={() => {
                setShowAddDialog(false);
                setNewVehicle(createEmptyNewVehicle());
              }}
              onSubmit={() => void handleCreateVehicle()}
              isSaving={isSaving}
              submitLabel="Guardar vehículo"
            />
            </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar vehículo */}
      <Dialog
        open={!!vehicleToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setVehicleToEdit(null);
            setNewVehicle(createEmptyNewVehicle());
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isPhotographer ? "Fotos del vehículo" : "Editar Vehículo"}</DialogTitle>
            <DialogDescription>
              {isPhotographer
                ? `Sube o agrega fotos para ${vehicleToEdit?.make} ${vehicleToEdit?.model}`
                : `Modifica los datos del vehículo ${vehicleToEdit?.make} ${vehicleToEdit?.model}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <div>
              <Label htmlFor="edit-images">Fotos del vehículo</Label>
              <div className="mt-2">
                {vehicleToEdit && ((vehicleToEdit.images as unknown as string[] | null) || []).length > 0 && (
                  <div className="flex flex-wrap gap-4 mb-4">
                    <p className="text-sm text-muted-foreground w-full">Imágenes actuales:</p>
                    {((vehicleToEdit.images as unknown as string[]) || []).map((img, index) => (
                      <div key={index} className="relative">
                        <VehicleImage
                          src={img}
                          alt={`Vehículo ${index + 1}`}
                          preset="thumb-sm"
                          className="w-24 h-24 object-cover rounded-lg border bg-muted"
                          displayWidth={96}
                          displayHeight={96}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {newVehicle.images.length > 0 && (
                  <div className="flex flex-wrap gap-4 mb-4">
                    <p className="text-sm text-muted-foreground w-full">Nuevas imágenes a agregar:</p>
                    {newVehicle.images.map((file, index) => {
                      return (
                        <div key={index} className="relative">
                          <LocalFilePreview
                            file={file}
                            alt={`Nueva ${index + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border bg-muted"
                            displayWidth={96}
                            displayHeight={96}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Input
                  id="edit-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Selecciona imágenes adicionales para agregar al vehículo
                </p>
              </div>
            </div>

            {isPhotographer && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-md">
                <div>
                  <Label htmlFor="edit-price-fotografo">{STOCK_ONLINE_COLUMN_LABELS.precio} (CLP)</Label>
                  <Input
                    id="edit-price-fotografo"
                    type="text"
                    value={formatNumberDisplay(newVehicle.price)}
                    onChange={(e) => {
                      try {
                        const formatted = formatNumberInput(e.target.value);
                        setNewVehicle(patchVehicleSalePrice(newVehicle, parseNumberInput(formatted)));
                      } catch (error) {
                        console.error("Error procesando precio:", error);
                      }
                    }}
                    placeholder="Ej: 15.990.000"
                  />
                </div>
              </div>
            )}

            {!isPhotographer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="edit-make">Marca</Label>
                <Input
                  id="edit-make"
                  value={newVehicle.make}
                  onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                  placeholder="Ej: Toyota"
                />
              </div>
              <div>
                <Label htmlFor="edit-model">{STOCK_ONLINE_COLUMN_LABELS.modelo}</Label>
                <Input
                  id="edit-model"
                  value={newVehicle.model}
                  onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  placeholder="Ej: Corolla Cross"
                />
              </div>
              <div>
                <Label htmlFor="edit-year">{STOCK_ONLINE_COLUMN_LABELS.anio}</Label>
                <Input
                  id="edit-year"
                  type="text"
                  value={newVehicle.year || ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (value === "") {
                      setNewVehicle({ ...newVehicle, year: 0 });
                    } else {
                      const yearNum = parseInt(value, 10);
                      if (!isNaN(yearNum)) {
                        setNewVehicle({ ...newVehicle, year: yearNum });
                      }
                    }
                  }}
                  placeholder="Ej: 2024"
                />
              </div>
              <div>
                <Label htmlFor="edit-carroceria">{STOCK_ONLINE_COLUMN_LABELS.carroceria}</Label>
                <Select
                  value={newVehicle.carroceria || undefined}
                  onValueChange={(value) => setNewVehicle({ ...newVehicle, carroceria: value })}
                >
                  <SelectTrigger id="edit-carroceria">
                    <SelectValue placeholder="Seleccionar carrocería" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CARROCERIA_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                    {legacySelectItem(newVehicle.carroceria, INVENTORY_CARROCERIA_OPTIONS)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-mileage">{STOCK_ONLINE_COLUMN_LABELS.kilometraje}</Label>
                <Input
                  id="edit-mileage"
                  type="text"
                  value={formatNumberDisplay(newVehicle.mileage)}
                  onChange={(e) => {
                    try {
                      const formatted = formatNumberInput(e.target.value);
                      setNewVehicle({ ...newVehicle, mileage: parseNumberInput(formatted) });
                    } catch (error) {
                      console.error("Error procesando kilometraje:", error);
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData("text");
                    const formatted = formatNumberInput(pastedText);
                    setNewVehicle({ ...newVehicle, mileage: parseNumberInput(formatted) });
                  }}
                  placeholder="Ej: 15.000"
                />
              </div>
              <div>
                <Label htmlFor="edit-engine_size">{STOCK_ONLINE_COLUMN_LABELS.motor}</Label>
                <Input
                  id="edit-engine_size"
                  value={newVehicle.engine_size}
                  onChange={(e) => setNewVehicle({ ...newVehicle, engine_size: e.target.value })}
                  placeholder="Ej: 2.0, 1600 cc"
                />
              </div>
              <div>
                <Label htmlFor="edit-engine_number">N° Motor</Label>
                <Input
                  id="edit-engine_number"
                  value={newVehicle.engine_number}
                  onChange={(e) => setNewVehicle({ ...newVehicle, engine_number: e.target.value })}
                  placeholder="N° de motor del vehículo"
                />
              </div>
              <div>
                <Label htmlFor="edit-vin">N° Chasis (VIN)</Label>
                <Input
                  id="edit-vin"
                  value={newVehicle.vin}
                  onChange={(e) => setNewVehicle({ ...newVehicle, vin: e.target.value })}
                  placeholder="N° de chasis / VIN"
                />
              </div>
              <div>
                <Label htmlFor="edit-transmision_display">{STOCK_ONLINE_COLUMN_LABELS.transmision}</Label>
                <Select
                  value={newVehicle.transmision_display || undefined}
                  onValueChange={(value) => {
                    const match = INVENTORY_TRANSMISION_OPTIONS.find((o) => o.value === value);
                    setNewVehicle({
                      ...newVehicle,
                      transmision_display: value,
                      transmission:
                        match?.transmission ?? deriveTransmissionFromExcelText(value),
                    });
                  }}
                >
                  <SelectTrigger id="edit-transmision_display">
                    <SelectValue placeholder="Seleccionar transmisión" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_TRANSMISION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.value}
                      </SelectItem>
                    ))}
                    {legacySelectItem(
                      newVehicle.transmision_display,
                      INVENTORY_TRANSMISION_OPTIONS.map((o) => o.value),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-combustible_display">{STOCK_ONLINE_COLUMN_LABELS.combustible}</Label>
                <Select
                  value={newVehicle.combustible_display || undefined}
                  onValueChange={(value) => {
                    const match = INVENTORY_COMBUSTIBLE_OPTIONS.find((o) => o.value === value);
                    setNewVehicle({
                      ...newVehicle,
                      combustible_display: value,
                      fuel_type: match?.fuel_type ?? deriveFuelTypeFromExcelText(value),
                    });
                  }}
                >
                  <SelectTrigger id="edit-combustible_display">
                    <SelectValue placeholder="Seleccionar combustible" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_COMBUSTIBLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.value}
                      </SelectItem>
                    ))}
                    {legacySelectItem(
                      newVehicle.combustible_display,
                      INVENTORY_COMBUSTIBLE_OPTIONS.map((o) => o.value),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-patente">{STOCK_ONLINE_COLUMN_LABELS.patente}</Label>
                <Input
                  id="edit-patente"
                  value={newVehicle.patente}
                  onChange={(e) => setNewVehicle({ ...newVehicle, patente: formatPatente(e.target.value) })}
                  placeholder="Ej: AB-CD-12"
                  maxLength={8}
                />
              </div>
              <div>
                <Label htmlFor="edit-price">{STOCK_ONLINE_COLUMN_LABELS.precio} (CLP)</Label>
                <Input
                  id="edit-price"
                  type="text"
                  value={formatNumberDisplay(newVehicle.price)}
                  onChange={(e) => {
                    try {
                      const formatted = formatNumberInput(e.target.value);
                      setNewVehicle(patchVehicleSalePrice(newVehicle, parseNumberInput(formatted)));
                    } catch (error) {
                      console.error("Error procesando precio:", error);
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData("text");
                    const formatted = formatNumberInput(pastedText);
                    setNewVehicle(patchVehicleSalePrice(newVehicle, parseNumberInput(formatted)));
                  }}
                  placeholder="Ej: 15.990.000"
                />
              </div>
              <div>
                <Label htmlFor="edit-consignatario_staff_id">{STOCK_ONLINE_COLUMN_LABELS.consignatario}</Label>
                <Select
                  value={newVehicle.consignatario_staff_id || "__none__"}
                  onValueChange={(v) =>
                    setNewVehicle({
                      ...newVehicle,
                      consignatario_staff_id: v === "__none__" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger id="edit-consignatario_staff_id">
                    <SelectValue placeholder="Seleccionar vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {salesStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                        {s.role_label ? ` · ${s.role_label}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-color">Color</Label>
                <Input
                  id="edit-color"
                  value={newVehicle.color}
                  onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                  placeholder="Ej: Blanco"
                />
              </div>
              <div>
                <Label htmlFor="edit-owner_name">Nombre del dueño</Label>
                <Input
                  id="edit-owner_name"
                  value={newVehicle.owner_name}
                  onChange={(e) => setNewVehicle({ ...newVehicle, owner_name: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div>
                <Label htmlFor="edit-owner_phone">Teléfono del dueño</Label>
                <Input
                  id="edit-owner_phone"
                  type="tel"
                  value={newVehicle.owner_phone}
                  onChange={(e) => setNewVehicle({ ...newVehicle, owner_phone: e.target.value })}
                  placeholder="Ej: +56 9 1234 5678"
                />
              </div>
              <div>
                <Label htmlFor="edit-consignment_type">Tipo de consignación</Label>
                <Select
                  value={newVehicle.consignment_type}
                  onValueChange={(value: ConsignmentType) =>
                    setNewVehicle({ ...newVehicle, consignment_type: value })
                  }
                >
                  <SelectTrigger id="edit-consignment_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fisica">Física</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-cost">Costo (CLP)</Label>
                <Input
                  id="edit-cost"
                  type="text"
                  value={formatNumberDisplay(newVehicle.cost)}
                  onChange={(e) => {
                    try {
                      const formatted = formatNumberInput(e.target.value);
                      setNewVehicle({ ...newVehicle, cost: parseNumberInput(formatted) });
                    } catch (error) {
                      console.error("Error procesando costo:", error);
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData("text");
                    const formatted = formatNumberInput(pastedText);
                    setNewVehicle({ ...newVehicle, cost: parseNumberInput(formatted) });
                  }}
                  placeholder="Ej: 12.000.000"
                />
              </div>
              <div>
                <Label htmlFor="edit-minDownPayment">Pie mínimo (30% del precio)</Label>
                <Input
                  id="edit-minDownPayment"
                  type="text"
                  readOnly
                  value={formatNumberDisplay(newVehicle.minDownPayment)}
                  className="bg-muted/60 cursor-default"
                  placeholder="Se calcula al ingresar el precio"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculado automáticamente: 30% del precio de venta.
                </p>
              </div>
              <div>
                <Label htmlFor="edit-drivetrain">Tracción</Label>
                <Select
                  value={newVehicle.drivetrain || undefined}
                  onValueChange={(value) => setNewVehicle({ ...newVehicle, drivetrain: value })}
                >
                  <SelectTrigger id="edit-drivetrain">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Delantera">Delantera</SelectItem>
                    <SelectItem value="Trasera">Trasera</SelectItem>
                    <SelectItem value="4WD">4WD (Tracción en las 4 ruedas)</SelectItem>
                    <SelectItem value="AWD">AWD (Tracción integral)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="edit-location">Ubicación física</Label>
                <Input
                  id="edit-location"
                  value={newVehicle.location}
                  onChange={(e) => setNewVehicle({ ...newVehicle, location: e.target.value })}
                  placeholder="Ej: Patio A, Estacionamiento 3"
                />
              </div>
            </div>
            )}
          </div>

          {!isPhotographer && (
            <VehicleFormPublicationFooter
              publicado={newVehicle.publicado}
              onPublicadoChange={(checked) => setNewVehicle({ ...newVehicle, publicado: checked })}
              publishSwitchId="publicado_edit"
              showStatus
              status={newVehicle.status}
              onStatusChange={(value) => setNewVehicle({ ...newVehicle, status: value })}
              onCancel={() => {
                setVehicleToEdit(null);
                setNewVehicle(createEmptyNewVehicle());
              }}
              onSubmit={() => void handleUpdateVehicle()}
              isSaving={isSaving}
              submitLabel="Guardar cambios"
            />
          )}

          {isPhotographer && (
            <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setVehicleToEdit(null);
                  setNewVehicle(createEmptyNewVehicle());
                }}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleUpdateVehicle()}
                disabled={isSaving}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
              >
                {isSaving ? "Guardando..." : "Guardar fotos y precio"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      {vehicleToDelete && (
        <AlertDialog
          open={!!vehicleToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) {
              // Solo permitir cerrar si no está eliminando
              requestAnimationFrame(() => {
                setVehicleToDelete(null);
                setIsDeleting(false);
              });
            }
          }}
        >
          <AlertDialogContent
            onInteractOutside={(e) => {
              if (isDeleting) {
                e.preventDefault();
              }
            }}
            onEscapeKeyDown={(e) => {
              if (isDeleting) {
                e.preventDefault();
              }
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el vehículo{" "}
                <strong>
                  {vehicleToDelete.make} {vehicleToDelete.model} {vehicleToDelete.year}
                </strong>{" "}
                del inventario.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={(e) => {
                  e.preventDefault();
                  if (!isDeleting) {
                    requestAnimationFrame(() => {
                      setVehicleToDelete(null);
                      setIsDeleting(false);
                    });
                  }
                }}
                disabled={isDeleting}
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (!isDeleting) {
                    handleDeleteVehicle();
                  }
                }}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Dialog para registrar venta */}
      <Dialog
        open={!!vehicleToSell}
        onOpenChange={(open) => {
          if (!open) {
            setVehicleToSell(null);
            setSaleData({
              salePrice: 0,
              downPayment: 0,
              paymentMethod: 'contado',
              notes: ''
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Venta</DialogTitle>
            <DialogDescription>
              Completa los datos de la venta de {vehicleToSell?.make} {vehicleToSell?.model} {vehicleToSell?.year}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Información del vehículo */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Información del Vehículo</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Vehículo:</span>
                  <p className="font-medium">{vehicleToSell?.make} {vehicleToSell?.model} {vehicleToSell?.year}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Precio Lista:</span>
                  <p className="font-medium">{formatCLP(Number(vehicleToSell?.price || 0))}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Costo:</span>
                  <p className="font-medium">{formatCLP(Number(vehicleToSell?.cost || 0))}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Margen Potencial:</span>
                  <p className="font-medium text-green-600">
                    {formatCLP(saleData.salePrice - Number(vehicleToSell?.cost || 0))}
                  </p>
                </div>
              </div>
            </div>

            {/* Precio de venta */}
            <div>
              <Label htmlFor="salePrice">Precio de Venta Final *</Label>
              <Input
                id="salePrice"
                type="text"
                value={formatNumberDisplay(saleData.salePrice)}
                onChange={(e) => {
                  const formatted = formatNumberInput(e.target.value);
                  setSaleData({ ...saleData, salePrice: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 15.990.000"
                required
              />
            </div>

            {/* Pie */}
            <div>
              <Label htmlFor="downPayment">Pie / Anticipo</Label>
              <Input
                id="downPayment"
                type="text"
                value={formatNumberDisplay(saleData.downPayment)}
                onChange={(e) => {
                  const formatted = formatNumberInput(e.target.value);
                  setSaleData({ ...saleData, downPayment: parseNumberInput(formatted) });
                }}
                placeholder="Ej: 3.000.000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Monto financiado: {formatCLP(saleData.salePrice - saleData.downPayment)}
              </p>
            </div>

            {/* Método de pago */}
            <div>
              <Label htmlFor="paymentMethod">Método de Pago</Label>
              <Select
                value={saleData.paymentMethod}
                onValueChange={(value) => setSaleData({ ...saleData, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contado">Contado</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="mixto">Mixto (Pie + Crédito)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div>
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Input
                id="notes"
                value={saleData.notes}
                onChange={(e) => setSaleData({ ...saleData, notes: e.target.value })}
                placeholder="Ej: Cliente referido, incluye accesorios..."
              />
            </div>

            {/* Resumen */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">Resumen de Venta</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Precio Venta:</span>
                  <p className="font-bold">{formatCLP(saleData.salePrice)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Margen:</span>
                  <p className="font-bold text-green-600">
                    {formatCLP(saleData.salePrice - Number(vehicleToSell?.cost || 0))}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Comisión (15%):</span>
                  <p className="font-bold text-blue-600">
                    {formatCLP((saleData.salePrice - Number(vehicleToSell?.cost || 0)) * 0.15)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setVehicleToSell(null);
                setSaleData({
                  salePrice: 0,
                  downPayment: 0,
                  paymentMethod: 'contado',
                  notes: ''
                });
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSellVehicle}
              disabled={isSaving || saleData.salePrice <= 0}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              {isSaving ? "Registrando..." : "Registrar Venta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
