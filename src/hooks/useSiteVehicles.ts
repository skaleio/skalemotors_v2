import { useQuery } from "@tanstack/react-query";
import { vehicleService } from "@/lib/services/vehicles";
import type { PreviewVehicle } from "@/components/website/blocks/VehiclesBlock";

/**
 * Trae una muestra del inventario disponible para alimentar el preview del
 * editor visual. RLS ya filtra por tenant del usuario autenticado.
 */
export function useSiteVehicles() {
  return useQuery<PreviewVehicle[]>({
    queryKey: ["site-preview-vehicles"],
    queryFn: async () => {
      const data = await vehicleService.getAll({ status: "disponible", mode: "list" });
      return (data ?? []).map((v) => ({
        id: v.id,
        make: v.make ?? null,
        model: v.model ?? null,
        year: v.year ?? null,
        price: v.price ?? null,
        mileage: v.mileage ?? null,
        primary_image_url: v.primary_image_url ?? null,
        images: v.images,
      }));
    },
    staleTime: 60_000,
  });
}
