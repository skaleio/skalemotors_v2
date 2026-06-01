import { Check, ChevronDown, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const VEHICLE_STATUS_LABELS = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  vendido_por_dueno: "Vendido por dueño",
  retirado: "Retirado",
  en_reparacion: "En reparación",
  fuera_de_servicio: "Fuera de servicio",
} as const;

export type VehicleStatus = keyof typeof VEHICLE_STATUS_LABELS;

export const VEHICLE_STATUS_ORDER: VehicleStatus[] = [
  "disponible",
  "reservado",
  "en_reparacion",
  "fuera_de_servicio",
  "vendido",
  "vendido_por_dueno",
  "retirado",
];

const statusColors: Record<VehicleStatus, string> = {
  disponible: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  reservado: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  vendido: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
  vendido_por_dueno: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
  retirado: "bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400",
  en_reparacion: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  fuera_de_servicio: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
};

function resolveStatus(status: string | null | undefined): VehicleStatus {
  if (status && status in VEHICLE_STATUS_LABELS) return status as VehicleStatus;
  return "disponible";
}

interface VehicleStatusPickerProps {
  status: string | null | undefined;
  disabled?: boolean;
  isUpdating?: boolean;
  onStatusChange: (status: VehicleStatus) => void;
}

export function VehicleStatusPicker({
  status,
  disabled,
  isUpdating,
  onStatusChange,
}: VehicleStatusPickerProps) {
  const current = resolveStatus(status);
  const label = VEHICLE_STATUS_LABELS[current];

  if (disabled) {
    return (
      <Badge variant="outline" className={statusColors[current]}>
        {label}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          title="Cambiar estado"
          disabled={isUpdating}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer gap-1 pr-1.5 hover:opacity-90 transition-opacity",
              statusColors[current]
            )}
          >
            <span>{label}</span>
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
            )}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[13.5rem]"
        onClick={(e) => e.stopPropagation()}
      >
        {VEHICLE_STATUS_ORDER.map((key) => (
          <DropdownMenuItem
            key={key}
            disabled={isUpdating || key === current}
            className="gap-2"
            onSelect={(e) => {
              e.preventDefault();
              if (key !== current) onStatusChange(key);
            }}
          >
            <span
              className={cn("h-2 w-2 rounded-full shrink-0", {
                "bg-green-600": key === "disponible",
                "bg-yellow-600": key === "reservado",
                "bg-blue-600": key === "en_reparacion",
                "bg-red-600": key === "fuera_de_servicio",
                "bg-gray-500": key === "vendido",
                "bg-orange-600": key === "vendido_por_dueno",
                "bg-slate-500": key === "retirado",
              })}
            />
            <span className="flex-1">{VEHICLE_STATUS_LABELS[key]}</span>
            {key === current ? <Check className="h-4 w-4 text-muted-foreground" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
