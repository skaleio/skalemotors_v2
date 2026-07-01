import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listPostableVehicles, type PostableVehicle } from "@/lib/services/zernioVehicles";

function priceCLP(value: number | null): string {
  if (value == null) return "Sin precio";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function VehiclePickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (vehicle: PostableVehicle) => void;
}) {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["zernio-postable-vehicles"],
    queryFn: listPostableVehicles,
    enabled: open,
    staleTime: 60_000,
  });

  const vehicles = query.data ?? [];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return vehicles;
    return vehicles.filter((v) =>
      [v.make, v.model, v.year?.toString(), v.patente]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(s)),
    );
  }, [vehicles, search]);

  const handlePick = (v: PostableVehicle) => {
    onSelect(v);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Elegir del inventario</DialogTitle>
          <DialogDescription>
            Autos disponibles que aún no has publicado en redes.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, año o patente…"
            className="pl-9"
          />
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {query.isPending && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando inventario…
            </p>
          )}
          {query.isError && (
            <p className="py-6 text-sm text-destructive">
              No se pudo cargar el inventario. {(query.error as Error).message}
            </p>
          )}
          {!query.isPending && !query.isError && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {vehicles.length === 0
                ? "No hay autos disponibles pendientes de publicar."
                : "Ningún auto coincide con la búsqueda."}
            </p>
          )}
          {filtered.map((v) => {
            const cover = v.primary_image_url || v.images[0] || null;
            const title = [v.make, v.model, v.year].filter(Boolean).join(" ") || "Vehículo";
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handlePick(v)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card/50 p-2 text-left transition hover:border-primary/50 hover:shadow-sm"
              >
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {cover ? (
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Car className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{priceCLP(v.price)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {v.patente && (
                      <Badge variant="outline" className="text-xs">
                        {v.patente}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {v.images.length > 0
                        ? `${v.images.length} foto${v.images.length === 1 ? "" : "s"}`
                        : "Sin fotos"}
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
