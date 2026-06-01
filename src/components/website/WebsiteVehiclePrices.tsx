import { useMemo, useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { VehiclePriceInput, parseVehiclePriceInput } from "@/components/inventory/VehiclePriceInput";
import { VehicleImage } from "@/components/VehicleImage";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { vehicleService } from "@/lib/services/vehicles";
import { formatCLP } from "@/lib/format";

const PLACEHOLDER_VEHICLE_IMAGE = "/placeholder-vehicle.svg";

function firstVehicleImageUrl(images: unknown): string {
  const list = images as string[] | null | undefined;
  if (!Array.isArray(list) || list.length === 0) return PLACEHOLDER_VEHICLE_IMAGE;
  const first = list.find((item) => typeof item === "string" && item.trim());
  return typeof first === "string" ? first : PLACEHOLDER_VEHICLE_IMAGE;
}

type WebPriceVehicle = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  cost: number | null;
  images: unknown;
};

export function WebsiteVehiclePrices() {
  const queryClient = useQueryClient();
  const { data: vehicles = [], isLoading, error, refetch } = useQuery<WebPriceVehicle[]>({
    queryKey: ["website-vehicle-prices"],
    queryFn: async () => {
      const data = await vehicleService.getAll({ status: "disponible", mode: "list" });
      return (data ?? []).map((v) => ({
        id: v.id,
        make: v.make ?? null,
        model: v.model ?? null,
        year: v.year ?? null,
        price: v.price ?? null,
        cost: v.cost ?? null,
        images: v.images,
      }));
    },
    staleTime: 60_000,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const blob = `${v.make ?? ""} ${v.model ?? ""} ${v.year ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [vehicles, searchQuery]);

  const updatePrice = useMutation({
    mutationFn: async ({
      id,
      price,
      cost,
    }: {
      id: string;
      price: number;
      cost: number | null;
    }) => {
      const margin = price - (cost ?? 0);
      await vehicleService.update(id, { price, margin });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["site-preview-vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["website-vehicle-prices"] });
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });

  const handlePriceBlur = async (
    vehicleId: string,
    currentPrice: number | null,
    currentCost: number | null,
    raw: string,
  ) => {
    const next = parseVehiclePriceInput(raw);
    if (next === null && raw.trim() !== "") return;
    const price = next ?? 0;
    if (price === (currentPrice ?? 0)) return;

    setSavingId(vehicleId);
    try {
      await updatePrice.mutateAsync({ id: vehicleId, price, cost: currentCost });
      toast.success("Precio actualizado en la vitrina");
    } catch (e) {
      toast.error("No se pudo guardar el precio", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precios en tu página web</CardTitle>
        <CardDescription>
          Los precios que edites aquí son los mismos del inventario y se muestran en la vitrina pública
          de tu automotora. Los visitantes verán el valor al instante tras guardar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Buscar por marca, modelo o año…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando vehículos publicables…
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            No se pudo cargar el inventario.{" "}
            <button type="button" className="underline" onClick={() => refetch()}>
              Reintentar
            </button>
          </p>
        )}

        {!isLoading && !error && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead className="min-w-[10rem]">Precio vitrina (CLP)</TableHead>
                  <TableHead className="w-[100px]">Vista</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No hay vehículos disponibles para mostrar precios.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                            <VehicleImage
                              src={firstVehicleImageUrl(v.images)}
                              alt=""
                              preset="thumb-xs"
                              className="h-full w-full object-cover"
                              displayWidth={40}
                              displayHeight={40}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {v.make} {v.model} {v.year}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Actual: {formatCLP(Number(v.price || 0))}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <VehiclePriceInput
                          value={v.price ?? null}
                          disabled={savingId === v.id}
                          className="h-9 max-w-[11rem]"
                          onBlur={(raw) =>
                            handlePriceBlur(v.id, v.price, v.cost, raw)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <a
                          href={`/app/consignaciones?vehicle=${v.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Inventario
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
