import type { VehiclePhotoAsset } from "@/lib/services/vehiclePhotos";

/** Fotos de álbum requeridas para pestaña «Listos» y publicar en vitrina. */
export const MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH = 15;

/** Álbum reservado: miniatura de consignación / referencia; no cuenta para publicar. */
export const CONSIGNMENT_REFERENCE_ALBUM = "Portada consignación";

export function isConsignmentReferenceAsset(asset: Pick<VehiclePhotoAsset, "album" | "counts_for_publish">): boolean {
  if (asset.counts_for_publish === false) return true;
  return (asset.album ?? "").trim() === CONSIGNMENT_REFERENCE_ALBUM;
}

export function countPublishableAlbumPhotos(
  assets: Pick<VehiclePhotoAsset, "album" | "counts_for_publish">[],
): number {
  return assets.filter((a) => !isConsignmentReferenceAsset(a)).length;
}

export function vehicleMeetsAlbumPublishMinimum(
  publishableCount: number,
): boolean {
  return publishableCount >= MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH;
}

export function albumPublishProgressLabel(publishableCount: number): string {
  return `${publishableCount}/${MIN_ALBUM_PHOTOS_FOR_WEB_PUBLISH} fotos de álbum`;
}
