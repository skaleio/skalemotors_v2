import type { VehiclePhotoAsset } from "@/lib/services/vehiclePhotos";

export type AlbumPhotoViewTab = "todas" | "carroceria" | "interior";

/** Nombre canónico al subir fotos de carrocería / exterior. */
export const ALBUM_NAME_EXTERIOR = "Exterior";
/** Nombre canónico al subir fotos de interior. */
export const ALBUM_NAME_INTERIOR = "Interior";

/** Nombres de álbum que se muestran en la pestaña Carrocería (incluye legacy). */
const CARROCERIA_ALBUM_KEYS = new Set([
  "exterior",
  "carrocería",
  "carroceria",
  "general",
  "detalles",
  "detalle",
]);

function normalizeAlbumKey(album: string): string {
  return (album ?? "").trim().toLowerCase();
}

export function albumMatchesPhotoViewTab(album: string, tab: AlbumPhotoViewTab): boolean {
  if (tab === "todas") return true;
  const key = normalizeAlbumKey(album);
  if (!key) return tab === "todas";
  if (tab === "interior") return key === "interior" || key === "interiores";
  return CARROCERIA_ALBUM_KEYS.has(key);
}

export function filterAssetsByPhotoViewTab(
  assets: VehiclePhotoAsset[],
  tab: AlbumPhotoViewTab,
): VehiclePhotoAsset[] {
  if (tab === "todas") return assets;
  return assets.filter((a) => albumMatchesPhotoViewTab(a.album, tab));
}

export function filterGroupedAlbumsByPhotoViewTab(
  grouped: Map<string, VehiclePhotoAsset[]>,
  tab: AlbumPhotoViewTab,
): Map<string, VehiclePhotoAsset[]> {
  if (tab === "todas") return grouped;
  const out = new Map<string, VehiclePhotoAsset[]>();
  for (const [name, list] of grouped) {
    if (albumMatchesPhotoViewTab(name, tab)) out.set(name, list);
  }
  return out;
}

export function countAssetsByPhotoViewTab(
  assets: VehiclePhotoAsset[],
  tab: AlbumPhotoViewTab,
): number {
  return filterAssetsByPhotoViewTab(assets, tab).length;
}

/** Agrupa assets por nombre de álbum (orden alfabético de álbum). */
export function groupAssetsByAlbum(assets: VehiclePhotoAsset[]): Map<string, VehiclePhotoAsset[]> {
  const map = new Map<string, VehiclePhotoAsset[]>();
  for (const asset of assets) {
    const key = asset.album?.trim() || "Sin álbum";
    const list = map.get(key) ?? [];
    list.push(asset);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** URL de miniatura del álbum: portada del álbum o primera foto. */
export function albumCoverUrl(assetsInAlbum: VehiclePhotoAsset[]): string | null {
  return assetsInAlbum.find((a) => a.is_cover)?.url ?? assetsInAlbum[0]?.url ?? null;
}

/**
 * Orden para vitrina / vehicles.images: portada global primero, luego el resto sin duplicar URL.
 * La portada sigue apareciendo en la rejilla de Álbumes (es una foto más, con badge).
 */
export function flattenVehicleImageUrls(assets: VehiclePhotoAsset[]): string[] {
  const cover = assets.filter((a) => a.is_cover);
  const rest = assets.filter((a) => !a.is_cover);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [...cover, ...rest]) {
    const url = a.url?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
