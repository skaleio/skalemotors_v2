import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Top 25 marcas más vendidas en Chile (orden alfabético). El user puede
 *  tipear y elegir cualquiera de éstas o escribir una custom (ej: "Lexus"). */
export const VEHICLE_MAKES = [
  "Audi",
  "BMW",
  "BYD",
  "Chevrolet",
  "Citroen",
  "Dodge",
  "Ford",
  "Great Wall",
  "Honda",
  "Hyundai",
  "Jeep",
  "Kia",
  "Maxus",
  "Mazda",
  "Mercedes-Benz",
  "MG",
  "Mitsubishi",
  "Nissan",
  "Peugeot",
  "Renault",
  "Subaru",
  "Suzuki",
  "Toyota",
  "Volkswagen",
  "Volvo",
] as const;

interface VehicleMakeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

/**
 * Combobox escribible para marca de vehículo:
 * - Dropdown con la lista predefinida de marcas comunes en Chile.
 * - Filtro vivo al tipear (cmdk built-in).
 * - Si el usuario tipea algo que no matchea, ofrece "Usar X" para guardar custom.
 * - El valor seleccionado se preserva exacto (case-sensitive) en el form state.
 */
export function VehicleMakeCombobox({
  value,
  onChange,
  placeholder = "Selecciona o escribe la marca",
  id,
  className,
}: VehicleMakeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
    setSearch("");
  };

  const trimmedSearch = search.trim();
  const searchMatchesKnown = VEHICLE_MAKES.some(
    (m) => m.toLowerCase() === trimmedSearch.toLowerCase(),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          {value || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar marca..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {trimmedSearch ? (
                <button
                  type="button"
                  onClick={() => commit(trimmedSearch)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  Usar &quot;{trimmedSearch}&quot;
                </button>
              ) : (
                <span className="px-3 py-2 text-sm text-muted-foreground">
                  No hay marcas.
                </span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {VEHICLE_MAKES.map((make) => (
                <CommandItem key={make} value={make} onSelect={() => commit(make)}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === make ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {make}
                </CommandItem>
              ))}
              {/* Si el value actual NO está en la lista pero hay algo guardado
                  (custom previo o legacy), mostrarlo como opción seleccionada. */}
              {value &&
                !VEHICLE_MAKES.includes(value as (typeof VEHICLE_MAKES)[number]) && (
                  <CommandItem value={value} onSelect={() => commit(value)}>
                    <Check className="mr-2 h-4 w-4 opacity-100" />
                    {value}{" "}
                    <span className="ml-2 text-xs text-muted-foreground">
                      (personalizado)
                    </span>
                  </CommandItem>
                )}
              {/* Si lo que el user tipea no matchea ninguna marca conocida,
                  ofrecer "Usar X" como opción adicional dentro del grupo. */}
              {trimmedSearch && !searchMatchesKnown && (
                <CommandItem
                  value={`__create_${trimmedSearch}`}
                  onSelect={() => commit(trimmedSearch)}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Usar &quot;{trimmedSearch}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
