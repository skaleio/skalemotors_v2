import { supabase } from "@/lib/supabase";
import { optimizeVehicleImageForUpload } from "@/lib/vehicleImageOptimize";

/** Cache largo en bucket público: el navegador reutiliza miniaturas entre visitas. */
export const VEHICLE_STORAGE_CACHE_CONTROL = "31536000";

export function safeAlbumPathSegment(albumRaw: string): string {
  return albumRaw.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "album";
}

export function buildVehicleStoragePath(
  vehicleId: string,
  albumSegment: string,
  originalFileName: string,
): string {
  const ext = originalFileName.split(".").pop() || "jpg";
  return `${vehicleId}/${safeAlbumPathSegment(albumSegment)}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}

export async function uploadVehicleImageToStorage(file: File, storagePath: string): Promise<string> {
  const optimized = await optimizeVehicleImageForUpload(file);
  const { error } = await supabase.storage.from("vehicles").upload(storagePath, optimized, {
    cacheControl: VEHICLE_STORAGE_CACHE_CONTROL,
    upsert: false,
    contentType: optimized.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("vehicles").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) break;
        results[index] = await fn(items[index], index);
      }
    }),
  );

  return results;
}

/** Optimiza y sube varias fotos en paralelo (límite de concurrencia para no saturar red/CPU). */
export async function uploadVehicleImagesBatch(
  vehicleId: string,
  albumSegment: string,
  files: Iterable<File>,
  opts?: { concurrency?: number },
): Promise<string[]> {
  const list = [...files].filter((f) => f.type.startsWith("image/"));
  if (!list.length) return [];

  return mapWithConcurrency(list, opts?.concurrency ?? 3, async (file) => {
    const path = buildVehicleStoragePath(vehicleId, albumSegment, file.name);
    return uploadVehicleImageToStorage(file, path);
  });
}
