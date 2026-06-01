import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Car } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { vehicleService } from "@/lib/services/vehicles";
import type { Database } from "@/lib/types/database";

type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

function vehicleLabel(v: Vehicle): string {
  const title = [v.make, v.model, v.year].filter(Boolean).join(" ");
  const plate = v.patente ? ` · ${v.patente}` : "";
  const price =
    v.price != null
      ? ` · ${new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v.price)}`
      : "";
  return `${title || "Sin datos"}${plate}${price}`;
}

interface InventoryVehiclePickerProps {
  branchId?: string;
  value: string;
  onSelect: (vehicle: Vehicle | null) => void;
  className?: string;
}

export function InventoryVehiclePicker({
  branchId,
  value,
  onSelect,
  className,
}: InventoryVehiclePickerProps) {
  const [open, setOpen] = useState(false);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["document-vehicle-picker", branchId ?? "all"],
    queryFn: () =>
      vehicleService.getAll({
        branchId,
        mode: "list",
      }),
    staleTime: 60_000,
  });

  const selected = useMemo(
    () => vehicles.find((v) => v.id === value) ?? null,
    [vehicles, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal h-9", className)}
        >
          <span className="flex items-center gap-2 truncate">
            <Car className="h-4 w-4 shrink-0 text-pink-500" />
            {isLoading
              ? "Cargando inventario..."
              : selected
                ? vehicleLabel(selected)
                : "Seleccionar del inventario (opcional)"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar marca, modelo, patente..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Cargando..." : "No hay vehículos en inventario."}
            </CommandEmpty>
            <CommandGroup>
              {value ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                >
                  Quitar selección (solo manual)
                </CommandItem>
              ) : null}
              {vehicles.map((v) => (
                <CommandItem
                  key={v.id}
                  value={`${v.make} ${v.model} ${v.patente} ${v.vin}`}
                  onSelect={() => {
                    onSelect(v);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === v.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate text-sm">{vehicleLabel(v)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
