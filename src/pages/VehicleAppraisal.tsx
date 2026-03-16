import { useMemo, useState } from "react";
import { Calculator, CarFront, ExternalLink, FileText, Loader2, RefreshCw, Search } from "lucide-react";

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
  getCachedAppraisal,
  getVehicleAppraisal,
  lookupVehicleByPatente,
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
    case "autofact":
      return "Autofact";
    case "boostr":
      return "Boostr";
    case "chileautos":
      return "ChileAutos";
    case "manual":
      return "Manual";
    default:
      return source || "Desconocida";
  }
}

function getConfidenceBadge(confianza: AppraisalResult["tasacion"]["confianza"], total: number) {
  if (confianza === "alta") {
    return {
      className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
      label: `Alta confianza (${total} muestras)`,
    };
  }
  if (confianza === "media") {
    return {
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
      label: `Confianza media (${total} muestras)`,
    };
  }
  return {
    className: "bg-red-100 text-red-800 hover:bg-red-100",
    label: `Baja confianza (${total} muestras)`,
  };
}

function getKpiTone(kind: "min" | "avg" | "max" | "median") {
  switch (kind) {
    case "min":
      return "border-emerald-200 bg-emerald-50";
    case "avg":
      return "border-blue-200 bg-blue-50";
    case "max":
      return "border-red-200 bg-red-50";
    case "median":
      return "border-slate-200 bg-slate-50";
  }
}

export default function VehicleAppraisal() {
  const { user } = useAuth();
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

  const handleLookup = async () => {
    if (!patenteValida) {
      toast.error("Ingresa una patente chilena válida, por ejemplo ABCD12.");
      return;
    }

    setLookupLoading(true);
    setAppraisal(null);
    setUsingCached(false);
    setCachedDate(null);
    setLookupError(null);

    try {
      const vehicleData = await lookupVehicleByPatente(normalizedPatente);
      setVehicle(vehicleData);

      if (branchId) {
        const cached = await getCachedAppraisal(normalizedPatente, branchId);
        if (cached) {
          setAppraisal(cached);
          setUsingCached(true);
          setCachedDate(cached.tasacion.fecha_consulta);
          setStep(3);
          toast.success("Se encontró una tasación cacheada de las últimas 24 horas.");
          return;
        }
      }

      setStep(2);
      toast.success("Vehículo encontrado correctamente.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo consultar la patente.";
      setLookupError(message);
      toast.error(message);
      setVehicle(null);
      setManualFormOpen(true);
      setManualMarca("");
      setManualModelo("");
      setManualAnio("");
      setManualMotor("");
      setManualCombustible("");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleAppraise = async () => {
    if (!vehicle) {
      toast.error("Primero debes confirmar los datos del vehículo.");
      return;
    }

    setAppraisalLoading(true);

    try {
      const result = await getVehicleAppraisal(vehicle, Number(toleranciaAnios));
      setAppraisal(result);
      setUsingCached(false);
      setCachedDate(result.tasacion.fecha_consulta);
      setStep(3);
      toast.success("Tasación calculada con datos del mercado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo calcular la tasación.";
      toast.error(message);
    } finally {
      setAppraisalLoading(false);
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
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">Tasación de Vehículos</CardTitle>
                <CardDescription>
                  Consulta una patente, confirma los datos del vehículo y calcula una tasación con comparables reales.
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((item) => {
              const active = step === item.id;
              const done = step > item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border px-4 py-3 ${
                    active
                      ? "border-blue-300 bg-blue-50"
                      : done
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Paso {item.id}
                  </div>
                  <div className="mt-1 font-semibold text-slate-900">{item.title}</div>
                </div>
              );
            })}
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" />
            Paso 1: Ingreso de patente
          </CardTitle>
          <CardDescription>
            Ingresa una patente chilena en formato moderno para buscar automáticamente el vehículo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mx-auto max-w-xl space-y-3">
            <Input
              value={patente}
              onChange={(event) => setPatente(normalizePatente(event.target.value))}
              placeholder="Ej: ABCD12"
              className="h-14 text-center text-2xl font-semibold tracking-[0.2em] uppercase"
              maxLength={6}
            />
            <div className="text-center text-sm">
              {normalizedPatente.length === 0 ? (
                <span className="text-slate-500">Formato esperado: 4 letras y 2 números.</span>
              ) : patenteValida ? (
                <span className="text-emerald-600">Formato válido.</span>
              ) : (
                <span className="text-red-600">Formato inválido. Usa un patrón como `ABCD12`.</span>
              )}
            </div>
            <Button
              onClick={handleLookup}
              className="h-12 w-full"
              disabled={lookupLoading || !patenteValida}
            >
              {lookupLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Buscar vehículo
            </Button>

            {lookupError && (
              <Card className="mt-4 border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-900">No se pudo obtener el vehículo por patente</CardTitle>
                  <CardDescription className="text-amber-800">{lookupError}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-amber-900">Puedes continuar ingresando los datos del vehículo manualmente:</p>
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
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarFront className="h-5 w-5 text-blue-600" />
              Paso 2: Confirmación del vehículo
            </CardTitle>
            <CardDescription>
              Revisa los datos detectados, corrígelos si hace falta y elige la tolerancia de años.
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
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="secondary" className="px-3 py-1">
                    Fuente: {getFuenteLabel(vehicle.fuente)}
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1">
                    Patente: {vehicle.patente}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                      id="marca"
                      value={vehicle.marca}
                      onChange={(event) => handleVehicleFieldChange("marca", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modelo">Modelo</Label>
                    <Input
                      id="modelo"
                      value={vehicle.modelo}
                      onChange={(event) => handleVehicleFieldChange("modelo", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="anio">Año</Label>
                    <Input
                      id="anio"
                      type="number"
                      min={1990}
                      max={2035}
                      value={vehicle.año}
                      onChange={(event) => handleVehicleFieldChange("año", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motor">Motor</Label>
                    <Input
                      id="motor"
                      value={vehicle.motor ?? ""}
                      onChange={(event) => handleVehicleFieldChange("motor", event.target.value)}
                      placeholder="Ej: 1.8"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="combustible">Combustible</Label>
                    <Input
                      id="combustible"
                      value={vehicle.combustible ?? ""}
                      onChange={(event) => handleVehicleFieldChange("combustible", event.target.value)}
                      placeholder="Ej: Gasolina"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transmision">Transmisión</Label>
                    <Input
                      id="transmision"
                      value={vehicle.transmision ?? ""}
                      onChange={(event) => handleVehicleFieldChange("transmision", event.target.value)}
                      placeholder="Ej: Automática"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kilometraje">Kilometraje</Label>
                    <Input
                      id="kilometraje"
                      type="number"
                      min={0}
                      placeholder="Ej: 45000"
                      value={kilometraje}
                      onChange={(e) => setKilometraje(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Opcional. Se usa para comparar con vehículos similares en el mercado.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado general</Label>
                    <Select value={estadoGeneral} onValueChange={(v) => setEstadoGeneral(v as "excelente" | "bueno" | "regular")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excelente">Excelente</SelectItem>
                        <SelectItem value="bueno">Bueno</SelectItem>
                        <SelectItem value="regular">Regular</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Afecta la tasación respecto al promedio de mercado.</p>
                  </div>
                </div>

                <div className="max-w-xs space-y-2">
                  <Label>Tolerancia de años</Label>
                  <Select value={toleranciaAnios} onValueChange={setToleranciaAnios}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona la tolerancia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 año</SelectItem>
                      <SelectItem value="2">2 años</SelectItem>
                      <SelectItem value="3">3 años</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleAppraise} disabled={appraisalLoading}>
                    {appraisalLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calculator className="mr-2 h-4 w-4" />
                    )}
                    Tasar este vehículo
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
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                Paso 3: Resultado de la tasación
              </CardTitle>
              <CardDescription>
                Comparables de mercado obtenidos desde fuentes externas y convertidos a CLP.
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
                    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-amber-900">
                        Usando datos del {new Date(cachedDate).toLocaleString("es-CL")}. ¿Actualizar?
                      </div>
                      <Button variant="outline" onClick={handleAppraise} disabled={appraisalLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Re-scrapear
                      </Button>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className={getKpiTone("min")}>
                      <CardContent className="pt-6">
                        <div className="text-sm text-slate-600">Precio mínimo</div>
                        <div className="mt-2 text-2xl font-bold">{formatCLP(appraisal.tasacion.precio_minimo)}</div>
                      </CardContent>
                    </Card>
                    <Card className={getKpiTone("avg")}>
                      <CardContent className="pt-6">
                        <div className="text-sm text-slate-600">Precio promedio</div>
                        <div className="mt-2 text-3xl font-bold text-blue-700">
                          {formatCLP(appraisal.tasacion.precio_promedio)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={getKpiTone("max")}>
                      <CardContent className="pt-6">
                        <div className="text-sm text-slate-600">Precio máximo</div>
                        <div className="mt-2 text-2xl font-bold">{formatCLP(appraisal.tasacion.precio_maximo)}</div>
                      </CardContent>
                    </Card>
                    <Card className={getKpiTone("median")}>
                      <CardContent className="pt-6">
                        <div className="text-sm text-slate-600">Mediana</div>
                        <div className="mt-2 text-2xl font-bold">{formatCLP(appraisal.tasacion.precio_mediana)}</div>
                      </CardContent>
                    </Card>
                  </div>

                  {confidence && (
                    <Badge className={`px-3 py-1 text-sm ${confidence.className}`}>{confidence.label}</Badge>
                  )}

                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Año</TableHead>
                          <TableHead>Precio</TableHead>
                          <TableHead>Km</TableHead>
                          <TableHead>Ver anuncio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {muestrasOrdenadas.map((muestra) => (
                          <TableRow key={muestra.url}>
                            <TableCell className="max-w-[320px] font-medium">
                              <span className="line-clamp-2">{muestra.titulo}</span>
                            </TableCell>
                            <TableCell>{muestra.año}</TableCell>
                            <TableCell>{formatCLP(muestra.precio)}</TableCell>
                            <TableCell>
                              {muestra.kilometros ? muestra.kilometros.toLocaleString("es-CL") : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" asChild>
                                <a href={muestra.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Abrir
                                </a>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={handleSave} disabled={saveLoading}>
                      {saveLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      Guardar tasación
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
