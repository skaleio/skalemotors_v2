import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ClipboardList, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCLP } from "@/lib/format";
import { consignacionesService } from "@/lib/services/consignaciones";

const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  en_revision: "En revisión",
  en_venta: "En venta",
  negociando: "Negociando",
  vendido: "Vendido",
  devuelto: "Devuelto",
};

const CONSIGNMENT_TYPE_LABEL: Record<string, string> = {
  fisica: "Física",
  digital: "Digital",
};

export type InventoryConsignmentSnapshot = {
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  price?: number | null;
  consignment_type?: string | null;
  min_down_payment?: number | null;
};

interface VehicleConsignacionPanelProps {
  vehicleId: string;
  patente?: string | null;
  branchId?: string;
  /** Datos del vehículo en stock; el inventario ya es la ficha de consignación. */
  inventoryConsignment?: InventoryConsignmentSnapshot | null;
}

export function VehicleConsignacionPanel({
  vehicleId,
  patente,
  branchId,
  inventoryConsignment,
}: VehicleConsignacionPanelProps) {
  const navigate = useNavigate();

  const { data: consignacion, isLoading, isError } = useQuery({
    queryKey: ["vehicle-consignacion", vehicleId, patente, branchId],
    queryFn: () =>
      consignacionesService.resolveForVehicle({
        vehicleId,
        patente,
        branchId,
      }),
    enabled: !!vehicleId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50/50 dark:bg-violet-950/20 p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
        Buscando consignación vinculada…
      </div>
    );
  }

  if (isError || !consignacion) {
    if (inventoryConsignment) {
      const tipo =
        CONSIGNMENT_TYPE_LABEL[inventoryConsignment.consignment_type ?? ""] ??
        (inventoryConsignment.consignment_type
          ? inventoryConsignment.consignment_type
          : "Consignación");

      return (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 dark:bg-violet-950/30 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Consignación en inventario
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              En stock este vehículo ya es la consignación
              {tipo ? ` (${tipo})` : ""}. El módulo Consignaciones es opcional: sirve para
              seguimiento comercial o una ficha vinculada antes de publicar en inventario.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/app/consignaciones")}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Módulo Consignaciones
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() =>
                navigate(`/app/documents/vehiculo/${vehicleId}?tipo=consignacion`)
              }
            >
              <FileText className="h-3.5 w-3.5" />
              Contrato de consignación
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        No hay una ficha activa en el módulo Consignaciones vinculada a este vehículo.
        {patente ? (
          <span className="block mt-1 font-mono text-xs">Patente: {patente}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 dark:bg-violet-950/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Consignación vinculada
          </p>
          <p className="font-semibold text-foreground mt-0.5">{consignacion.owner_name}</p>
          <p className="text-xs text-muted-foreground">
            {[consignacion.owner_phone, consignacion.owner_email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {STATUS_LABEL[consignacion.status] ?? consignacion.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-background/80 border px-2 py-1.5">
          <p className="text-[10px] text-muted-foreground">Precio venta</p>
          <p className="font-medium">{formatCLP(consignacion.sale_price)}</p>
        </div>
        <div className="rounded-lg bg-background/80 border px-2 py-1.5">
          <p className="text-[10px] text-muted-foreground">Precio consignación</p>
          <p className="font-medium">{formatCLP(consignacion.consignacion_price)}</p>
        </div>
        {consignacion.patente && (
          <div className="rounded-lg bg-background/80 border px-2 py-1.5 col-span-2">
            <p className="text-[10px] text-muted-foreground">Patente en ficha consignación</p>
            <p className="font-mono font-medium">{consignacion.patente}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            navigate(`/app/consignaciones`, {
              state: { highlightConsignacionId: consignacion.id },
            })
          }
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Ver en Consignaciones
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() =>
            navigate(`/app/documents/vehiculo/${vehicleId}?tipo=consignacion`)
          }
        >
          <FileText className="h-3.5 w-3.5" />
          Contrato de consignación
        </Button>
      </div>
    </div>
  );
}
