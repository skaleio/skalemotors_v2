import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Car, FileText, Plus, Search, ScrollText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VehicleImage } from "@/components/VehicleImage";
import { DocumentTemplatesPanel } from "@/components/documents/DocumentTemplatesPanel";

import { useAuth } from "@/contexts/AuthContext";
import { documentService, Document, DocumentType } from "@/lib/services/documents";
import { consignacionesService } from "@/lib/services/consignaciones";
import { vehicleService } from "@/lib/services/vehicles";
import type { Database } from "@/lib/types/database";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

interface VehicleRow {
  vehicle: Vehicle;
  documents: Document[];
  hasConsignacion: boolean;
}

const TYPE_BADGE: Record<DocumentType, { label: string; className: string }> = {
  contrato_consignacion: { label: "Consignación", className: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  contrato_venta: { label: "Venta", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
};

function formatUpdated(date: string) {
  return new Date(date).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const ACTIVE_CONSIGNACION_STATUSES = new Set([
  "nuevo",
  "en_revision",
  "en_venta",
  "negociando",
]);

function normalizePlate(patente?: string | null): string {
  return patente?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
}

function vehicleThumbnailSrc(vehicle: Vehicle): string | null {
  if (vehicle.primary_image_url?.trim()) return vehicle.primary_image_url;
  const imgs = vehicle.images;
  if (Array.isArray(imgs) && imgs.length > 0) {
    const first = imgs[0];
    if (typeof first === "string" && first.trim()) return first;
  }
  return null;
}

const VEHICLE_STATUS_LABEL: Record<string, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  en_transito: "En tránsito",
  en_taller: "En taller",
  no_disponible: "No disponible",
};

export default function DocumentsHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("documentos");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["documents-hub", user?.tenant_id],
    queryFn: async () => {
      // Mismo criterio que Inventario: todo el stock del tenant (RLS), sin filtrar sucursal.
      const [documents, consignaciones, vehicles] = await Promise.all([
        documentService.getAll(),
        consignacionesService.getAll(),
        vehicleService.getAll({ mode: "list" }),
      ]);
      return { documents, consignaciones, vehicles };
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: 2,
  });

  const rows = useMemo((): VehicleRow[] => {
    if (!data) return [];

    const docsByVehicleId = new Map<string, Document[]>();
    for (const d of data.documents) {
      if (!d.vehicle_id) continue;
      const list = docsByVehicleId.get(d.vehicle_id) ?? [];
      list.push(d);
      docsByVehicleId.set(d.vehicle_id, list);
    }

    const consignacionByVehicleId = new Set<string>();
    const consignacionByPatente = new Set<string>();
    for (const c of data.consignaciones) {
      if (!ACTIVE_CONSIGNACION_STATUSES.has(c.status)) continue;
      if (c.vehicle_id) consignacionByVehicleId.add(c.vehicle_id);
      const plate = normalizePlate(c.patente);
      if (plate) consignacionByPatente.add(plate);
    }

    const result: VehicleRow[] = data.vehicles.map((vehicle) => {
      const documents = (docsByVehicleId.get(vehicle.id) ?? []).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      const plate = normalizePlate(vehicle.patente);
      const hasConsignacion =
        consignacionByVehicleId.has(vehicle.id) ||
        (plate.length > 0 && consignacionByPatente.has(plate));

      return { vehicle, documents, hasConsignacion };
    });

    return result.sort((a, b) => {
      const score = (r: VehicleRow) =>
        (r.documents.length > 0 ? 4 : 0) + (r.hasConsignacion ? 2 : 0);
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      const ta = a.documents[0]?.updated_at ?? a.vehicle.updated_at ?? "";
      const tb = b.documents[0]?.updated_at ?? b.vehicle.updated_at ?? "";
      return new Date(tb).getTime() - new Date(ta).getTime();
    });
  }, [data]);

  const filtered = rows.filter((row) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const v = row.vehicle;
    return (
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q) ||
      v.patente?.toLowerCase().includes(q) ||
      row.documents.some((d) => d.document_number?.toLowerCase().includes(q))
    );
  });

  const openVehicle = (vehicleId: string, tipo: "consignacion" | "venta" = "consignacion") => {
    navigate(`/app/documents/vehiculo/${vehicleId}?tipo=${tipo}`);
  };

  const canManageTemplates =
    user?.role === "admin" || user?.role === "gerente" || user?.role === "jefe_jefe";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Documentos</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {isLoading
              ? "Cargando inventario…"
              : `${rows.length} vehículo${rows.length === 1 ? "" : "s"} en stock — abre uno para crear o editar su contrato`}
          </p>
        </div>
        {tab === "documentos" && (
          <Button
            className="bg-pink-600 hover:bg-pink-700 text-white gap-2"
            onClick={() => toast.message("Selecciona un vehículo en la tabla para crear o editar su contrato")}
          >
            <Plus className="h-4 w-4" />
            Crear nuevo
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="documentos" className="gap-2">
            <FileText className="h-4 w-4" />
            Documentos
          </TabsTrigger>
          {canManageTemplates && (
            <TabsTrigger value="plantillas" className="gap-2">
              <ScrollText className="h-4 w-4" />
              Plantillas
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="documentos" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por vehículo, patente o N° documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-16 flex justify-center">
                  <div className="h-8 w-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isError ? (
                <div className="py-16 text-center text-sm space-y-2 px-4">
                  <p className="text-destructive font-medium">No se pudo cargar el inventario</p>
                  <p className="text-muted-foreground text-xs">
                    {error instanceof Error ? error.message : "Error desconocido"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                  >
                    Reintentar
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm px-4">
                  {rows.length === 0
                    ? "No hay vehículos en inventario. Agrega stock en Inventario para generar contratos aquí."
                    : "Ningún vehículo coincide con la búsqueda."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Documentos</TableHead>
                      <TableHead>Última actualización</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const latest = row.documents[0];
                      const types = new Set(row.documents.map((d) => d.type));
                      return (
                        <TableRow
                          key={row.vehicle.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openVehicle(row.vehicle.id, "consignacion")}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <VehicleImage
                                src={vehicleThumbnailSrc(row.vehicle)}
                                alt={`${row.vehicle.make} ${row.vehicle.model}`}
                                preset="thumb-sm"
                                className="h-12 w-16 rounded object-cover bg-muted"
                                displayWidth={64}
                                displayHeight={48}
                              />
                              <div>
                                <p className="font-medium">
                                  {[row.vehicle.make, row.vehicle.model, row.vehicle.year]
                                    .filter(Boolean)
                                    .join(" ")}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {row.vehicle.patente ?? row.vehicle.id.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">
                              {VEHICLE_STATUS_LABEL[row.vehicle.status ?? ""] ??
                                row.vehicle.status ??
                                "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Array.from(types).map((t) => (
                                <Badge
                                  key={t}
                                  variant="secondary"
                                  className={TYPE_BADGE[t].className}
                                >
                                  {TYPE_BADGE[t].label}
                                </Badge>
                              ))}
                              {row.hasConsignacion && !types.has("contrato_consignacion") && (
                                <Badge
                                  variant="outline"
                                  className="text-violet-700 border-violet-300 text-[10px]"
                                >
                                  Consignación activa
                                </Badge>
                              )}
                              {types.size === 0 && !row.hasConsignacion && (
                                <span className="text-xs text-muted-foreground">Sin contrato</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {latest
                              ? formatUpdated(latest.updated_at)
                              : row.hasConsignacion
                                ? "Sin contrato aún"
                                : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Abrir contrato"
                              onClick={(e) => {
                                e.stopPropagation();
                                openVehicle(row.vehicle.id, "consignacion");
                              }}
                            >
                              <Car className="h-4 w-4 text-pink-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManageTemplates && (
          <TabsContent value="plantillas" className="mt-4">
            <DocumentTemplatesPanel tenantId={user?.tenant_id} branchId={user?.branch_id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
