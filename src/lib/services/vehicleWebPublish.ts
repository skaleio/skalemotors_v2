import {
  isVehicleWebPublishableStatus,
  MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH,
  vehicleHasMinimumAlbumPhotos,
  type VehicleStockStatus,
} from "@/lib/website/albumQueues";
import { vehicleService } from "@/lib/services/vehicles";
import { vehiclePhotosService } from "@/lib/services/vehiclePhotos";

export class VehicleWebPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VehicleWebPublishError";
  }
}

type PublishableVehicle = {
  status: VehicleStockStatus;
  price: number | null;
  publishablePhotoCount: number;
};

/** Mensaje en español si no se puede publicar; null si OK. */
export function validateVehicleWebPublish(vehicle: PublishableVehicle): string | null {
  if (!isVehicleWebPublishableStatus(vehicle.status)) {
    return "Solo se puede publicar un vehículo disponible o reservado.";
  }
  if (!vehicleHasMinimumAlbumPhotos(vehicle.publishablePhotoCount)) {
    return `Para publicar en la vitrina se requieren al menos ${MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH} fotos de álbum (la portada de consignación no cuenta).`;
  }
  if (Number(vehicle.price || 0) <= 0) {
    return "Para publicar, el vehículo debe tener un precio mayor a $0.";
  }
  return null;
}

export const vehicleWebPublishService = {
  async publish(vehicleId: string): Promise<void> {
    const vehicle = await vehicleService.getById(vehicleId);
    const publishablePhotoCount = await vehiclePhotosService.countPublishable(vehicleId);
    const reason = validateVehicleWebPublish({
      status: vehicle.status,
      price: vehicle.price,
      publishablePhotoCount,
    });
    if (reason) throw new VehicleWebPublishError(reason);
    await vehicleService.update(vehicleId, { publicado_web: true } as any);
  },

  async unpublish(vehicleId: string): Promise<void> {
    await vehicleService.update(vehicleId, { publicado_web: false } as any);
  },
};
