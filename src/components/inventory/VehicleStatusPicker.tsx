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

/** Un color distinto por estado (badge + punto del menú). */
export const VEHICLE_STATUS_STYLES: Record<
  VehicleStatus,
  { badge: string; dot: string }
> = {
  disponible: {
    badge:
      "border-emerald-300/70 bg-emerald-100 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-300",
    dot: "bg-emerald-600",
  },
  reservado: {
    badge:
      "border-amber-300/70 bg-amber-100 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  en_reparacion: {
    badge:
      "border-sky-300/70 bg-sky-100 text-sky-900 dark:border-sky-700/60 dark:bg-sky-950/50 dark:text-sky-300",
    dot: "bg-sky-600",
  },
  fuera_de_servicio: {
    badge:
      "border-rose-300/70 bg-rose-100 text-rose-900 dark:border-rose-700/60 dark:bg-rose-950/50 dark:text-rose-300",
    dot: "bg-rose-600",
  },
  vendido: {
    badge:
      "border-zinc-400/70 bg-zinc-200 text-zinc-900 dark:border-zinc-600/60 dark:bg-zinc-800/80 dark:text-zinc-200",
    dot: "bg-zinc-600",
  },
  vendido_por_dueno: {
    badge:
      "border-orange-300/70 bg-orange-100 text-orange-950 dark:border-orange-700/60 dark:bg-orange-950/50 dark:text-orange-300",
    dot: "bg-orange-600",
  },
  retirado: {
    badge:
      "border-violet-300/70 bg-violet-100 text-violet-950 dark:border-violet-700/60 dark:bg-violet-950/50 dark:text-violet-300",
    dot: "bg-violet-600",
  },
};

function resolveStatus(status: string | null | undefined): VehicleStatus {
  if (status && status in VEHICLE_STATUS_LABELS) return status as VehicleStatus;
  return "disponible";
}

/** Etiqueta con punto de color (filtros, formularios). */
export function VehicleStatusLabel({
  statusKey,
  className,
}: {
  statusKey: string;
  className?: string;
}) {
  const key = resolveStatus(statusKey);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/15",
          VEHICLE_STATUS_STYLES[key].dot
        )}
      />
      <span>{VEHICLE_STATUS_LABELS[key]}</span>
    </span>
  );
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
      <Badge variant="outline" className={VEHICLE_STATUS_STYLES[current].badge}>
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
              VEHICLE_STATUS_STYLES[current].badge
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
              className={cn(
                "h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/15",
                VEHICLE_STATUS_STYLES[key].dot
              )}
            />
            <span className="flex-1">{VEHICLE_STATUS_LABELS[key]}</span>
            {key === current ? <Check className="h-4 w-4 text-muted-foreground" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
