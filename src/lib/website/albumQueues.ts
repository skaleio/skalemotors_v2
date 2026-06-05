import type { Database } from "@/lib/types/database";
import {
  MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH,
  vehicleMeetsAlbumPublishMinimum,
} from "@/lib/website/albumPublishRules";

export type VehicleStockStatus = Database["public"]["Tables"]["vehicles"]["Row"]["status"];

export const VEHICLE_WEB_PUBLISHABLE_STATUSES: readonly VehicleStockStatus[] = [
  "disponible",
  "reservado",
] as const;

export const VEHICLE_WEB_AUTO_UNPUBLISH_STATUSES: readonly VehicleStockStatus[] = [
  "vendido",
  "vendido_por_dueno",
  "retirado",
  "en_reparacion",
  "fuera_de_servicio",
] as const;

export type AlbumQueueTab = "sin_fotos" | "listos" | "en_web" | "todos";

export type AlbumVehicleRow = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  patente: string | null;
  price: number | null;
  /** Miniatura de listado (evita traer el array `images` completo). */
  primary_image_url: string | null;
  /** Fotos de álbum que cuentan para vitrina (excluye portada de consignación). */
  publishable_photo_count: number;
  publicado_web: boolean;
  status: VehicleStockStatus;
};

/** @deprecated Usar publishable_photo_count / vehicleMeetsAlbumPublishMinimum. */
export function vehicleHasPhotos(images: unknown): boolean {
  const list = images as string[] | null | undefined;
  if (!Array.isArray(list)) return false;
  return list.some((item) => typeof item === "string" && item.trim().length > 0);
}

export function vehicleHasMinimumAlbumPhotos(publishableCount: number): boolean {
  return vehicleMeetsAlbumPublishMinimum(publishableCount);
}

export { MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH };

export function isVehicleWebPublishableStatus(status: VehicleStockStatus): boolean {
  return (VEHICLE_WEB_PUBLISHABLE_STATUSES as readonly string[]).includes(status);
}

export function matchesAlbumQueueTab(row: AlbumVehicleRow, tab: AlbumQueueTab): boolean {
  const ready = vehicleHasMinimumAlbumPhotos(row.publishable_photo_count);
  const operativo = isVehicleWebPublishableStatus(row.status);

  switch (tab) {
    case "sin_fotos":
      return !ready;
    case "listos":
      return ready && !row.publicado_web && operativo;
    case "en_web":
      return row.publicado_web && operativo;
    case "todos":
    default:
      return true;
  }
}

export function filterAlbumVehicles(
  vehicles: AlbumVehicleRow[],
  tab: AlbumQueueTab,
  search: string,
): AlbumVehicleRow[] {
  const needle = search.trim().toLowerCase();
  return vehicles.filter((v) => {
    if (!matchesAlbumQueueTab(v, tab)) return false;
    if (!needle) return true;
    const blob = `${v.make ?? ""} ${v.model ?? ""} ${v.year ?? ""} ${v.patente ?? ""}`.toLowerCase();
    return blob.includes(needle);
  });
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStockStatus, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  vendido_por_dueno: "Vendido por dueño",
  retirado: "Retirado",
  en_reparacion: "En reparación",
  fuera_de_servicio: "Fuera de servicio",
};
