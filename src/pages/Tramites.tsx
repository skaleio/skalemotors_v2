import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCLP, sanitizeIntegerInput } from "@/lib/format";
import {
  calcularValorPermisoCirculacion,
  calcularValorTransferencia,
  simularTransferencia,
} from "@/lib/services/tramites";
import { useAuth } from "@/contexts/AuthContext";
import { useTramites, useTramiteTipos, useCreateTramite } from "@/hooks/useTramites";
import {
  ClipboardList,
  ExternalLink,
  FileCheck,
  History,
  Calculator,
  Car,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";

const CHECKLIST_ITEMS = [
  "Cédula de identidad del vendedor y comprador",
  "Permiso de circulación al día",
  "Revisión técnica vigente",
  "Padrón del vehículo (certificado de inscripción)",
  "Contrato de compraventa (firmado)",
  "Pago de transferencia y timbres",
  "Certificado de multas al día (opcional)",
  "Informe Autofact/Full (recomendado)",
];

const PLANTAS_REVISION_REGIONES = [
  { region: "RM", url: "https://www.autofact.cl/", note: "Consultar plantas en Autofact o revisión técnica oficial" },
];

export default function Tramites() {
  const { user } = useAuth();
  const branchId = (user as { branch_id?: string })?.branch_id ?? undefined;
  const { data: tipos = [] } = useTramiteTipos();
  const { data: tramitesList = [], isLoading } = useTramites({ branchId });
  const createTramite = useCreateTramite();

  const [avaluoFiscal, setAvaluoFiscal] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [simPrecio, setSimPrecio] = useState("");
  const [simAvaluo, setSimAvaluo] = useState("");
  const [simIncluirPermiso, setSimIncluirPermiso] = useState(true);
  const [checklistState, setChecklistState] = useState<Record<number, boolean>>({});

  const valorPermiso = useMemo(() => {
    const n = parseInt(avaluoFiscal.replace(/\D/g, ""), 10) || 0;
    return calcularValorPermisoCirculacion(n);
  }, [avaluoFiscal]);

  const valorTransferencia = useMemo(() => {
    const n = parseInt(precioVenta.replace(/\D/g, ""), 10) || 0;
    return calcularValorTransferencia(n);
  }, [precioVenta]);

  const simulacion = useMemo(() => {
    const precio = parseInt(simPrecio.replace(/\D/g, ""), 10) || 0;
    const avaluo = simAvaluo ? parseInt(simAvaluo.replace(/\D/g, ""), 10) || 0 : undefined;
    return simularTransferencia({
      precioVenta: precio,
      avaluoFiscal: avaluo || undefined,
      incluirPermiso: simIncluirPermiso,
    });
  }, [simPrecio, simAvaluo, simIncluirPermiso]);

  const toggleChecklist = (index: number) => {
    setChecklistState((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const tiposSinApi = useMemo(() => tipos.filter((t) => !t.requires_api), [tipos]);
  const tiposConApi = useMemo(() => tipos.filter((t) => t.requires_api), [tipos]);

  const handleGuardarCalculo = async (code: string, payload: Record<string, unknown>) => {
    if (!branchId) return;
    const tipo = tipos.find((t) => t.code === code);
    if (!tipo) return;
    try {
      await createTramite.mutateAsync({
        branch_id: branchId,
        tramite_tipo_id: tipo.id,
        status: "completado",
        result_payload: payload,
        created_by: (user as { id?: string })?.id ?? null,
      });
      toast({ title: "Cálculo guardado en historial" });
    } catch (e) {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ClipboardList className="h-8 w-6" />
          Trámites
        </h1>
        <p className="text-muted-foreground mt-2">
          Herramientas vehiculares tipo Autofact: permisos, transferencias y checklist. Integración Autofact preparada.
        </p>
      </div>

      <Tabs defaultValue="herramientas" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="herramientas">Herramientas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="autofact">Autofact</TabsTrigger>
        </TabsList>

        <TabsContent value="herramientas" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Valor permiso de circulación
                </CardTitle>
                <CardDescription>
                  Aproximado según avalúo fiscal (2,5% en Chile). Sin API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Avalúo fiscal (CLP)</Label>
                  <Input
                    placeholder="Ej: 5.000.000"
                    value={avaluoFiscal}
                    onChange={(e) => setAvaluoFiscal(sanitizeIntegerInput(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <p className="text-2xl font-semibold text-primary">
                  {formatCLP(valorPermiso)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleGuardarCalculo("valor_permiso", {
                      avaluo_fiscal: parseInt(avaluoFiscal.replace(/\D/g, ""), 10) || 0,
                      valor_permiso: valorPermiso,
                    })
                  }
                >
                  Guardar en historial
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Valor transferencia
                </CardTitle>
                <CardDescription>
                  Aproximado 1,5% sobre precio de venta. Sin API.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Precio de venta (CLP)</Label>
                  <Input
                    placeholder="Ej: 12.000.000"
                    value={precioVenta}
                    onChange={(e) => setPrecioVenta(sanitizeIntegerInput(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <p className="text-2xl font-semibold text-primary">
                  {formatCLP(valorTransferencia)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleGuardarCalculo("valor_transferencia", {
                      precio_venta: parseInt(precioVenta.replace(/\D/g, ""), 10) || 0,
                      valor_transferencia: valorTransferencia,
                    })
                  }
                >
                  Guardar en historial
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Simulador de transferencia
              </CardTitle>
              <CardDescription>
                Transferencia + permiso de circulación (opcional).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Precio de venta (CLP)</Label>
                  <Input
                    placeholder="Ej: 15.000.000"
                    value={simPrecio}
                    onChange={(e) => setSimPrecio(sanitizeIntegerInput(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Avalúo fiscal (CLP) — opcional</Label>
                  <Input
                    placeholder="Si no ingresa, se estima ~85% del precio"
                    value={simAvaluo}
                    onChange={(e) => setSimAvaluo(sanitizeIntegerInput(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="incluir-permiso"
                  checked={simIncluirPermiso}
                  onCheckedChange={(c) => setSimIncluirPermiso(!!c)}
                />
                <Label htmlFor="incluir-permiso">Incluir permiso de circulación</Label>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-1">
                <p><span className="text-muted-foreground">Transferencia:</span> {formatCLP(simulacion.transferencia)}</p>
                <p><span className="text-muted-foreground">Permiso:</span> {formatCLP(simulacion.permiso)}</p>
                <p className="font-semibold pt-2">Total aproximado: {formatCLP(simulacion.total)}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleGuardarCalculo("simulador_transferencia", {
                    precio_venta: parseInt(simPrecio.replace(/\D/g, ""), 10) || 0,
                    avaluo: simAvaluo ? parseInt(simAvaluo.replace(/\D/g, ""), 10) : undefined,
                    ...simulacion,
                  })
                }
              >
                Guardar en historial
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Checklist pre-venta / transferencia
              </CardTitle>
              <CardDescription>
                Documentos y pasos recomendados para venta o transferencia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {CHECKLIST_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Checkbox
                      checked={!!checklistState[i]}
                      onCheckedChange={() => toggleChecklist(i)}
                    />
                    <span className={checklistState[i] ? "text-muted-foreground line-through" : ""}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Plantas de revisión técnica
              </CardTitle>
              <CardDescription>
                Consulta oficial en el sitio de revisión técnica o en Autofact.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Para ver plantas por región y horarios, puedes usar la herramienta gratuita de Autofact o la página oficial de revisión técnica.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="https://www.autofact.cl/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver en Autofact
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de trámites y cálculos
              </CardTitle>
              <CardDescription>
                Trámites y resultados guardados de esta sucursal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Cargando...</p>
              ) : tramitesList.length === 0 ? (
                <p className="text-muted-foreground">Aún no hay trámites registrados.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Vehículo / Datos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tramitesList.map((t) => {
                      const tipo = (t as { tramite_tipo?: { name: string; code: string } }).tramite_tipo;
                      const veh = (t as { vehicle?: { make: string; model: string; year: number } }).vehicle;
                      const label = veh
                        ? `${veh.make} ${veh.model} ${veh.year}`
                        : t.patente || t.marca
                          ? [t.patente, t.marca, t.modelo, t.anio].filter(Boolean).join(" ")
                          : tipo?.code ?? "—";
                      return (
                        <TableRow key={t.id}>
                          <TableCell>
                            {t.created_at
                              ? new Date(t.created_at).toLocaleDateString("es-CL", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell>{tipo?.name ?? t.tramite_tipo_id ?? "—"}</TableCell>
                          <TableCell>{label}</TableCell>
                          <TableCell>
                            <span
                              className={
                                t.status === "completado"
                                  ? "text-green-600"
                                  : t.status === "error"
                                    ? "text-red-600"
                                    : "text-muted-foreground"
                              }
                            >
                              {t.status}
                            </span>
                          </TableCell>
                          <TableCell>{t.cost != null ? formatCLP(Number(t.cost)) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="autofact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Integración Autofact
              </CardTitle>
              <CardDescription>
                Para usar Informe Full y Transferencia online, configura tu API de Autofact en Configuración → Integraciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Funcionalidades que requieren API Autofact (cuando esté disponible):
              </p>
              <ul className="list-disc list-inside space-y-1">
                {tiposConApi.map((t) => (
                  <li key={t.id}>
                    <strong>{t.name}</strong>
                    {t.description && ` — ${t.description}`}
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                Las herramientas de esta página que no requieren API ya están operativas: valor permiso, valor transferencia, simulador y checklist.
              </p>
              <Button variant="outline" asChild>
                <a href="/app/integrations">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ir a Integraciones
                </a>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Herramientas disponibles sin API
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {tiposSinApi.map((t) => (
                  <li key={t.id}>{t.name}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
