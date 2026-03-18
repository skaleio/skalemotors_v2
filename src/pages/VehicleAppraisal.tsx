import { useMemo, useState } from "react";
import { Calculator, CarFront, ExternalLink, FileText, Loader2, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { formatCLP } from "@/lib/format";
import {
  getAppraisalByPatente,
  getCachedAppraisal,
  saveAppraisal,
  type AppraisalResult,
  type VehicleData,
} from "@/lib/services/vehicleAppraisalService";
import { toast } from "@/components/ui/sonner";

type Step = 1 | 2 | 3;

const PATENTE_REGEX = /^[A-Z]{4}\d{2}$/;

const steps = [
  { id: 1, title: "Patente" },
  { id: 2, title: "Vehículo" },
  { id: 3, title: "Tasación" },
] as const;

function normalizePatente(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidPatente(value: string): boolean {
  return PATENTE_REGEX.test(normalizePatente(value));
}

function getFuenteLabel(source: string): string {
  switch (source) {
    case "getapi":
      return "Mercado";
    case "manual":
      return "Manual";
    default:
      return "Mercado";
  }
}

function getConfidenceBadge(confianza: AppraisalResult["tasacion"]["confianza"], total: number) {
  if (confianza === "alta") {
    return {
      className:
        "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
      label: `Alta confianza (${total} muestras)`,
    };
  }
  if (confianza === "media") {
    return {
      className:
        "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/50",
      label: `Confianza media (${total} muestras)`,
    };
  }
  return {
    className:
      "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/50",
    label: `Baja confianza (${total} muestras)`,
  };
}

function getKpiTone(kind: "min" | "avg" | "max" | "median") {
  switch (kind) {
    case "min":
      return "border-emerald-200 bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-950/35";
    case "avg":
      return "border-blue-200 bg-blue-50 dark:border-blue-800/80 dark:bg-blue-950/40";
    case "max":
      return "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/35";
    case "median":
      return "border-border bg-muted/50 dark:bg-muted/30";
  }
}

function buildChileautosUrl({
  brand,
  model,
  year,
  mileage,
}: {
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
}) {
  const cleanBrand = (brand ?? "").trim().replace(/\./g, "");
  const cleanModel = (model ?? "").trim().replace(/\./g, "").replace(/\s+/g, "+");
  const filters: string[] = [];

  if (cleanBrand || cleanModel) {
    filters.push(`(C.Marca.${cleanBrand}._.Modelo.${cleanModel}.)`);
  }

  if (typeof year === "number" && Number.isFinite(year) && year > 0) {
    filters.push(`Ano.range(${year - 1}..${year + 1}).`);
  }

  if (typeof mileage === "number" && Number.isFinite(mileage) && mileage > 0) {
    const kmMin = Math.max(0, Math.round(mileage - 20000));
    const kmMax = Math.round(mileage + 20000);
    filters.push(`Kilometraje.range(${kmMin}..${kmMax}).`);
  }

  if (filters.length === 0) {
    return "https://www.chileautos.cl/vehiculos/";
  }

  const q = `(And.${filters.join("_.")})`;
  return `https://www.chileautos.cl/vehiculos/?q=${encodeURIComponent(q).replace(/%20/g, "+")}`;
}

export default function VehicleAppraisal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const branchId = user?.branch_id ?? "";

  const [step, setStep] = useState<Step>(1);
  const [patente, setPatente] = useState("");
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [appraisal, setAppraisal] = useState<AppraisalResult | null>(null);
  const [toleranciaAnios, setToleranciaAnios] = useState("2");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [appraisalLoading, setAppraisalLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [usingCached, setUsingCached] = useState(false);
  const [cachedDate, setCachedDate] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualMarca, setManualMarca] = useState("");
  const [manualModelo, setManualModelo] = useState("");
  const [manualAnio, setManualAnio] = useState("");
  const [manualMotor, setManualMotor] = useState("");
  const [manualCombustible, setManualCombustible] = useState("");
  const [kilometraje, setKilometraje] = useState("");
  const [estadoGeneral, setEstadoGeneral] = useState<"excelente" | "bueno" | "regular">("bueno");

  const normalizedPatente = normalizePatente(patente);
  const patenteValida = isValidPatente(normalizedPatente);
  const muestrasOrdenadas = useMemo(
    () => [...(appraisal?.muestras ?? [])].sort((a, b) => a.precio - b.precio).slice(0, 15),
    [appraisal],
  );

  const confidence = appraisal
    ? getConfidenceBadge(appraisal.tasacion.confianza, appraisal.tasacion.total_muestras)
    : null;

  const getComparableUrl = (muestra: AppraisalResult["muestras"][number]) => {
    if (typeof muestra.url === "string" && /^https?:\/\/(www\.)?chileautos\.cl/i.test(muestra.url)) {
      return muestra.url;
    }

    return buildChileautosUrl({
      brand: vehicle?.marca,
      model: vehicle?.modelo,
      year: vehicle?.año || muestra.año,
      mileage:
        typeof vehicle?.kilometraje === "number" && vehicle.kilometraje > 0
          ? vehicle.kilometraje
          : muestra.kilometros,
    });
  };

  const handleOpenComparable = (muestra: AppraisalResult["muestras"][number]) => {
    const url = getComparableUrl(muestra);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleAgregarConsignacion = () => {
    if (!vehicle) {
      toast.error("Primero obtén una tasación para precargar el vehículo.");
      return;
    }

    const params = new URLSearchParams({
      new: "true",
      source: "appraisal",
      patente: vehicle.patente || "",
      make: vehicle.marca || "",
      model: vehicle.modelo || "",
      year: vehicle.año ? String(vehicle.año) : "",
    });

    navigate(`/app/consignaciones?${params.toString()}`);
  };

  const resetAll = () => {
    setStep(1);
    setPatente("");
    setVehicle(null);
    setAppraisal(null);
    setToleranciaAnios("2");
    setUsingCached(false);
    setCachedDate(null);
    setLookupError(null);
    setManualFormOpen(false);
    setManualMarca("");
    setManualModelo("");
    setManualAnio("");
    setManualMotor("");
    setManualCombustible("");
    setKilometraje("");
    setEstadoGeneral("bueno");
  };

  const handleContinueManual = () => {
    const marca = manualMarca.trim();
    const modelo = manualModelo.trim();
    const año = Number(manualAnio.replace(/\D/g, "")) || new Date().getFullYear();
    if (!marca || !modelo) {
      toast.error("Marca y modelo son obligatorios para continuar.");
      return;
    }
    setVehicle({
      patente: normalizedPatente || "SIN PATENTE",
      marca,
      modelo,
      año: año || new Date().getFullYear(),
      motor: manualMotor.trim() || null,
      combustible: manualCombustible.trim() || null,
      transmision: null,
      fuente: "manual",
      kilometraje: null,
    });
    setStep(2);
    setLookupError(null);
    setManualFormOpen(false);
    toast.success("Continuando con datos manuales. Revisa y completa kilometraje y estado.");
  };

  const handleVehicleFieldChange = (
    field: keyof Pick<VehicleData, "marca" | "modelo" | "año" | "motor" | "combustible" | "transmision">,
    value: string,
  ) => {
    setVehicle((current) => {
      if (!current) return current;
      if (field === "año") {
        const nextYear = Number(value.replace(/\D/g, "")) || current.año;
        return { ...current, año: nextYear, fuente: "manual" };
      }
      return { ...current, [field]: value || null, fuente: "manual" };
    });
  };

  // Una sola petición: patente → GetAPI appraisal → vehículo + tasación
  const handleObtenerTasacion = async () => {
    if (!patenteValida) {
      toast.error("Ingresa una patente chilena válida, por ejemplo ABCD12.");
      return;
    }

    setLookupLoading(true);
    setAppraisal(null);
    setVehicle(null);
    setUsingCached(false);
    setCachedDate(null);
    setLookupError(null);
    setManualFormOpen(false);

    try {
      if (branchId) {
        const cached = await getCachedAppraisal(normalizedPatente, branchId);
        if (cached) {
          setVehicle({
            patente: normalizedPatente,
            marca: "",
            modelo: "",
            año: 0,
            motor: null,
            combustible: null,
            transmision: null,
            fuente: "getapi",
            kilometraje: null,
          });
          setAppraisal(cached);
          setUsingCached(true);
          setCachedDate(cached.tasacion.fecha_consulta);
          setStep(3);
          toast.success("Se encontró una tasación cacheada de las últimas 24 horas.");
          return;
        }
      }

      const { vehicle: v, appraisal: a } = await getAppraisalByPatente(normalizedPatente);
      setVehicle(v);
      setAppraisal(a);

      // Intentar precargar el kilometraje desde los datos enriquecidos
      const kmFromVehicle = typeof v.kilometraje === "number" ? v.kilometraje : null;
      const kmFromSamples =
        Array.isArray(a.muestras) && typeof a.muestras[0]?.kilometros === "number"
          ? a.muestras[0]?.kilometros
          : null;
      const km = kmFromVehicle && kmFromVehicle > 0 ? kmFromVehicle : kmFromSamples && kmFromSamples > 0 ? kmFromSamples : null;
      if (km) {
        setKilometraje(String(km));
      }
      setCachedDate(a.tasacion.fecha_consulta);
      setStep(3);
      toast.success("Tasación obtenida correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo obtener la tasación.";
      setLookupError(message);
      toast.error(message);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSave = async () => {
    if (!vehicle || !appraisal) {
      toast.error("No hay una tasación lista para guardar.");
      return;
    }

    if (!branchId) {
      toast.error("Tu usuario no tiene sucursal asociada, por lo que no se puede guardar la caché.");
      return;
    }

    setSaveLoading(true);
    try {
      await saveAppraisal(normalizedPatente, vehicle, appraisal, branchId);
      toast.success("Tasación guardada en Supabase.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la tasación.";
      toast.error(message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!vehicle || !appraisal) {
      toast.error("No hay datos para exportar.");
      return;
    }

    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Tasación de Vehículo", 14, 18);
      doc.setFontSize(11);
      doc.text(`Patente: ${vehicle.patente}`, 14, 28);
      doc.text(`Vehículo: ${vehicle.marca} ${vehicle.modelo} ${vehicle.año}`, 14, 35);
      doc.text(`Promedio mercado: ${formatCLP(appraisal.tasacion.precio_promedio)}`, 14, 42);
      doc.text(`Muestras: ${appraisal.tasacion.total_muestras}`, 14, 49);

      autoTable(doc, {
        startY: 58,
        head: [["Título", "Año", "Precio", "Km"]],
        body: muestrasOrdenadas.map((muestra) => [
          muestra.titulo,
          muestra.año,
          formatCLP(muestra.precio),
          muestra.kilometros ? muestra.kilometros.toLocaleString("es-CL") : "—",
        ]),
      });

      doc.save(`tasacion-${vehicle.patente}.pdf`);
      toast.success("PDF exportado correctamente.");
    } catch {
      toast.error("No se pudo exportar el PDF.");
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25">
            <Calculator className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Tasación de Vehículos
            </h1>
            <p className="mt-1 text-muted-foreground">
              Ingresa una patente chilena y obtén el valor de mercado estimado al instante.
            </p>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl bg-muted/70 p-1.5 dark:bg-muted/40">
          {steps.map((item) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <div
                key={item.id}
                className={`flex flex-1 items-center gap-2 rounded-lg px-4 py-2.5 transition-colors ${
                  active
                    ? "bg-card text-card-foreground shadow-sm ring-1 ring-border"
                    : done
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : done
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : item.id}
                </span>
                <span className="font-medium">{item.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-muted-foreground" />
            Ingreso de patente
          </CardTitle>
          <CardDescription>
            Patente chilena en formato actual (4 letras y 2 números). Ej: ABCD12
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mx-auto max-w-xl space-y-3">
            <Input
              value={patente}
              onChange={(event) => setPatente(normalizePatente(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !lookupLoading && patenteValida) {
                  event.preventDefault();
                  handleObtenerTasacion();
                }
              }}
              placeholder="Ej: ABCD12"
              className="h-14 text-center text-2xl font-semibold tracking-[0.2em] uppercase"
              maxLength={6}
            />
            <div className="text-center text-sm">
              {normalizedPatente.length === 0 ? (
                <span className="text-muted-foreground">Formato esperado: 4 letras y 2 números.</span>
              ) : patenteValida ? (
                <span className="text-emerald-600 dark:text-emerald-400">Formato válido.</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Formato inválido. Usa un patrón como `ABCD12`.</span>
              )}
            </div>
            <Button
              onClick={handleObtenerTasacion}
              className="h-12 w-full bg-blue-600 text-white hover:bg-blue-700 hover:text-white dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 [&_svg]:text-white"
              disabled={lookupLoading || !patenteValida}
            >
              {lookupLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Obtener tasación
            </Button>

            {lookupError && (
              <Card className="mt-4 border-amber-200 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    No se pudo obtener el vehículo por patente
                  </CardTitle>
                  <CardDescription className="text-amber-800 dark:text-amber-200/90">{lookupError}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-amber-900 dark:text-amber-100/95">
                    Puedes continuar ingresando los datos del vehículo manualmente:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="manual-marca">Marca *</Label>
                      <Input
                        id="manual-marca"
                        placeholder="Ej: Toyota"
                        value={manualMarca}
                        onChange={(e) => setManualMarca(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-modelo">Modelo *</Label>
                      <Input
                        id="manual-modelo"
                        placeholder="Ej: Corolla"
                        value={manualModelo}
                        onChange={(e) => setManualModelo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-anio">Año</Label>
                      <Input
                        id="manual-anio"
                        type="number"
                        min={1990}
                        max={2035}
                        placeholder="Ej: 2018"
                        value={manualAnio}
                        onChange={(e) => setManualAnio(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-motor">Motor (opcional)</Label>
                      <Input
                        id="manual-motor"
                        placeholder="Ej: 1.8"
                        value={manualMotor}
                        onChange={(e) => setManualMotor(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="manual-combustible">Combustible (opcional)</Label>
                      <Input
                        id="manual-combustible"
                        placeholder="Ej: Gasolina"
                        value={manualCombustible}
                        onChange={(e) => setManualCombustible(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={handleContinueManual} variant="secondary" className="w-full sm:w-auto">
                    Continuar con datos manuales
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {(lookupLoading || (step >= 2 && vehicle)) && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CarFront className="h-5 w-5 text-muted-foreground" />
              Datos del vehículo
            </CardTitle>
            <CardDescription>
              Revisa o corrige los datos si es necesario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lookupLoading || !vehicle ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : (
              <>
                {/* Resumen del vehículo */}
                <div className="rounded-2xl border border-border bg-gradient-to-br from-muted/40 to-card p-5 dark:from-muted/20 dark:to-card">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-lg bg-slate-800 px-3 py-1.5 font-mono text-sm font-semibold tracking-wider text-white dark:bg-zinc-700">
                      {vehicle.patente}
                    </span>
                    <span className="text-lg font-semibold text-foreground">
                      {[vehicle.marca, vehicle.modelo, vehicle.año].filter(Boolean).join(" · ") || "Sin datos"}
                    </span>
                  </div>
                </div>

                {/* Ficha técnica en bloques */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Identificación
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="marca" className="text-muted-foreground">Marca</Label>
                        <Input
                          id="marca"
                          className="bg-background"
                          value={vehicle.marca}
                          onChange={(event) => handleVehicleFieldChange("marca", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="modelo" className="text-muted-foreground">Modelo</Label>
                        <Input
                          id="modelo"
                          className="bg-background"
                          value={vehicle.modelo}
                          onChange={(event) => handleVehicleFieldChange("modelo", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="anio" className="text-muted-foreground">Año</Label>
                        <Input
                          id="anio"
                          type="number"
                          min={1990}
                          max={2035}
                          className="bg-background"
                          value={vehicle.año}
                          onChange={(event) => handleVehicleFieldChange("año", event.target.value)}
                        />
                      </div>
                    </div>
                    {typeof vehicle.kilometraje === "number" && vehicle.kilometraje > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Kilometraje actual registrado:&nbsp;
                        <span className="font-semibold text-foreground">
                          {vehicle.kilometraje.toLocaleString("es-CL")} km
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Motorización
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="motor" className="text-muted-foreground">Motor</Label>
                        <Input
                          id="motor"
                          className="bg-background"
                          value={vehicle.motor ?? ""}
                          onChange={(event) => handleVehicleFieldChange("motor", event.target.value)}
                          placeholder="Ej: 1.8"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="combustible" className="text-muted-foreground">Combustible</Label>
                        <Input
                          id="combustible"
                          className="bg-background"
                          value={vehicle.combustible ?? ""}
                          onChange={(event) => handleVehicleFieldChange("combustible", event.target.value)}
                          placeholder="Ej: Gasolina"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="transmision" className="text-muted-foreground">Transmisión</Label>
                        <Input
                          id="transmision"
                          className="bg-background"
                          value={vehicle.transmision ?? ""}
                          onChange={(event) => handleVehicleFieldChange("transmision", event.target.value)}
                          placeholder="Ej: Automática"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ajustes y opciones */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 dark:bg-muted/20">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ajustes para la tasación
                  </h4>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[140px] space-y-1.5">
                      <Label htmlFor="kilometraje" className="text-muted-foreground">Kilometraje</Label>
                      <Input
                        id="kilometraje"
                        type="number"
                        min={0}
                        placeholder="Ej: 45000"
                        className="bg-background"
                        value={kilometraje}
                        onChange={(e) => setKilometraje(e.target.value)}
                      />
                    </div>
                    <div className="min-w-[160px] space-y-1.5">
                      <Label className="text-muted-foreground">Estado general</Label>
                      <Select value={estadoGeneral} onValueChange={(v) => setEstadoGeneral(v as "excelente" | "bueno" | "regular")}>
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excelente">Excelente</SelectItem>
                          <SelectItem value="bueno">Bueno</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[160px] space-y-1.5">
                      <Label className="text-muted-foreground">Tolerancia de años</Label>
                      <Select value={toleranciaAnios} onValueChange={setToleranciaAnios}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Tolerancia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 año</SelectItem>
                          <SelectItem value="2">2 años</SelectItem>
                          <SelectItem value="3">3 años</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Kilometraje y estado afectan la comparación con el mercado. Tolerancia define el rango de años de los
                    comparables.
                  </p>
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row">
                  <Button
                    onClick={handleObtenerTasacion}
                    disabled={lookupLoading}
                    className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white dark:text-white [&_svg]:text-white"
                  >
                    {lookupLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="mr-2 h-4 w-4" />
                    )}
                    Actualizar tasación
                  </Button>
                  <Button variant="outline" onClick={resetAll}>
                    Cambiar patente
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {(appraisalLoading || appraisal) && (
        <div className="space-y-4">
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/40 dark:bg-muted/25">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5 text-muted-foreground" />
                Resultado de la tasación
              </CardTitle>
              <CardDescription>
                Valor de mercado estimado según datos actuales. Precios en pesos chilenos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {appraisalLoading || !appraisal ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                </div>
              ) : (
                <>
                  {usingCached && cachedDate && (
                    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/35 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-amber-900 dark:text-amber-100">
                        Usando datos del {new Date(cachedDate).toLocaleString("es-CL")}. ¿Actualizar?
                      </div>
                      <Button variant="outline" onClick={handleObtenerTasacion} disabled={lookupLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Volver a consultar
                      </Button>
                    </div>
                  )}

                  {/* Resumen de rango */}
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 dark:bg-muted/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Rango de valor de mercado</span>
                      <span className="font-semibold text-foreground">
                        {formatCLP(appraisal.tasacion.precio_minimo)} — {formatCLP(appraisal.tasacion.precio_maximo)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: "linear-gradient(to right, rgb(52 211 153), rgb(59 130 246), rgb(248 113 113))",
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>Mínimo</span>
                      <span className="font-medium text-blue-600 dark:text-sky-400">Promedio</span>
                      <span>Máximo</span>
                    </div>
                  </div>

                  {/* Precio de retoma sugerido */}
                  {typeof appraisal.precio_retoma === "number" && appraisal.precio_retoma > 0 && (
                    <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-emerald-50 to-white px-4 py-4 shadow-sm dark:border-emerald-800/60 dark:from-emerald-950/50 dark:via-emerald-950/40 dark:to-card">
                      <div className="absolute -right-10 -top-8 h-24 w-24 rounded-full bg-emerald-100 opacity-60 dark:bg-emerald-900/40 dark:opacity-80" />
                      <div className="absolute -right-4 -bottom-6 h-16 w-16 rounded-full bg-emerald-200 opacity-50 dark:bg-emerald-900/30" />
                      <div className="relative flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Precio retoma sugerido
                          </div>
                          <div className="mt-1 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
                            {formatCLP(appraisal.precio_retoma)}
                          </div>
                        </div>
                        <div className="flex flex-col items-start text-xs text-emerald-900/80 dark:text-emerald-200/90 sm:items-end">
                          <span>Referencia para compra en parte de pago.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* KPIs */}
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className={`rounded-2xl border-2 ${getKpiTone("min")} shadow-sm transition-shadow hover:shadow`}>
                      <CardContent className="pt-5 pb-5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mínimo</div>
                        <div className="mt-1.5 text-xl font-bold tracking-tight text-foreground">
                          {formatCLP(appraisal.tasacion.precio_minimo)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={`rounded-2xl border-2 ${getKpiTone("avg")} shadow-md transition-shadow hover:shadow-lg`}>
                      <CardContent className="pt-5 pb-5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-sky-400">
                          Promedio
                        </div>
                        <div className="mt-1.5 text-2xl font-bold tracking-tight text-blue-700 dark:text-sky-300">
                          {formatCLP(appraisal.tasacion.precio_promedio)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={`rounded-2xl border-2 ${getKpiTone("max")} shadow-sm transition-shadow hover:shadow`}>
                      <CardContent className="pt-5 pb-5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Máximo</div>
                        <div className="mt-1.5 text-xl font-bold tracking-tight text-foreground">
                          {formatCLP(appraisal.tasacion.precio_maximo)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={`rounded-2xl border-2 ${getKpiTone("median")} shadow-sm transition-shadow hover:shadow`}>
                      <CardContent className="pt-5 pb-5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mediana</div>
                        <div className="mt-1.5 text-xl font-bold tracking-tight text-foreground">
                          {formatCLP(appraisal.tasacion.precio_mediana)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {confidence && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Nivel de confianza:</span>
                      <Badge className={`px-3 py-1.5 text-sm ${confidence.className}`}>{confidence.label}</Badge>
                    </div>
                  )}

                  {/* Tabla de comparables */}
                  <div>
                    <h4 className="mb-3 text-sm font-semibold text-foreground">
                      Comparables en el mercado ({muestrasOrdenadas.length} anuncios)
                    </h4>
                    <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border bg-muted/50 hover:bg-muted/50 dark:bg-muted/40">
                            <TableHead className="font-semibold text-foreground">Vehículo</TableHead>
                            <TableHead className="font-semibold text-foreground">Año</TableHead>
                            <TableHead className="font-semibold text-foreground">Precio</TableHead>
                            <TableHead className="font-semibold text-foreground">Km</TableHead>
                            <TableHead className="w-[100px] font-semibold text-foreground">Enlace</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {muestrasOrdenadas.map((muestra, index) => (
                            <TableRow
                              key={`${muestra.url || muestra.titulo}-${index}`}
                              className="transition-colors hover:bg-muted/40"
                            >
                              <TableCell className="max-w-[280px] font-medium text-foreground">
                                <span className="line-clamp-2">{muestra.titulo}</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{muestra.año}</TableCell>
                              <TableCell className="font-semibold text-foreground">{formatCLP(muestra.precio)}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {muestra.kilometros ? muestra.kilometros.toLocaleString("es-CL") : "—"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-sky-400 dark:hover:bg-sky-950/50 dark:hover:text-sky-300"
                                  onClick={() => handleOpenComparable(muestra)}
                                >
                                  <ExternalLink className="mr-1.5 h-4 w-4" />
                                  Ver
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-border pt-5">
                    <Button
                      onClick={handleSave}
                      disabled={saveLoading}
                      className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white dark:text-white [&_svg]:text-white"
                    >
                      {saveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Guardar tasación
                    </Button>
                    <Button variant="outline" onClick={handleAgregarConsignacion}>
                      Agregar consignación
                    </Button>
                    <Button variant="outline" onClick={resetAll}>
                      Nueva tasación
                    </Button>
                    <Button variant="outline" onClick={handleExportPdf}>
                      Exportar PDF
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
