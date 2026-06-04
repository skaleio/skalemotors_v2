import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";
import { vehicleService } from "@/lib/services/vehicles";
import { albumCoverUrl, flattenVehicleImageUrls } from "@/lib/website/albumDisplay";
import {
  CONSIGNMENT_REFERENCE_ALBUM,
  countPublishableAlbumPhotos,
  isConsignmentReferenceAsset,
} from "@/lib/website/albumPublishRules";

export type VehiclePhotoAsset =
  Database["public"]["Tables"]["vehicle_photo_assets"]["Row"];

export type VehiclePhotoAlbumSummary = {
  album: string;
  count: number;
  publishableCount: number;
  coverUrl: string | null;
  isReferenceAlbum: boolean;
};

function normalizeAlbumName(raw: string): string {
  return raw.trim();
}

async function resolveVehicleTenantId(vehicleId: string): Promise<string> {
  const vehicle = await vehicleService.getById(vehicleId);
  const tenantId = (vehicle as { tenant_id?: string | null }).tenant_id;
  if (!tenantId) throw new Error("No se pudo resolver el tenant del vehículo.");
  return tenantId;
}

export const vehiclePhotosService = {
  async listByVehicle(vehicleId: string): Promise<VehiclePhotoAsset[]> {
    const { data, error } = await supabase
      .from("vehicle_photo_assets")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as VehiclePhotoAsset[];
  },

  async listAlbumNames(vehicleId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("vehicle_photo_assets")
      .select("album")
      .eq("vehicle_id", vehicleId);
    if (error) throw error;
    const set = new Set((data ?? []).map((r) => (r as any).album as string));
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
  },

  async createAlbumIfMissing(vehicleId: string, albumRaw: string): Promise<void> {
    const album = normalizeAlbumName(albumRaw);
    if (!album) throw new Error("Nombre de álbum requerido");
    const existing = await this.listAlbumNames(vehicleId);
    if (existing.includes(album)) return;
    // Álbum “vacío” no existe como entidad: se materializa con la primera foto.
    // Esta función se deja para futuras extensiones; hoy no hace nada.
  },

  async countPublishableByVehicleIds(vehicleIds: string[]): Promise<Record<string, number>> {
    if (!vehicleIds.length) return {};
    const { data, error } = await supabase
      .from("vehicle_photo_assets")
      .select("vehicle_id, album, counts_for_publish")
      .in("vehicle_id", vehicleIds);
    if (error) throw error;
    const out: Record<string, number> = {};
    for (const id of vehicleIds) out[id] = 0;
    for (const row of data ?? []) {
      const r = row as Pick<VehiclePhotoAsset, "vehicle_id" | "album" | "counts_for_publish">;
      if (isConsignmentReferenceAsset(r)) continue;
      out[r.vehicle_id] = (out[r.vehicle_id] ?? 0) + 1;
    }
    return out;
  },

  async countPublishable(vehicleId: string): Promise<number> {
    const map = await this.countPublishableByVehicleIds([vehicleId]);
    return map[vehicleId] ?? 0;
  },

  /** Portada de consignación: visible en listados, no suma al mínimo de 15 fotos de álbum. */
  async addConsignmentReferenceCover(input: {
    vehicleId: string;
    url: string;
    makeCover?: boolean;
  }): Promise<void> {
    const url = input.url.trim();
    if (!url) return;
    const tenantId = await resolveVehicleTenantId(input.vehicleId);
    const { error } = await supabase.from("vehicle_photo_assets").insert({
      tenant_id: tenantId,
      vehicle_id: input.vehicleId,
      album: CONSIGNMENT_REFERENCE_ALBUM,
      url,
      sort_order: 0,
      is_cover: input.makeCover ?? true,
      counts_for_publish: false,
    } as any);
    if (error) throw error;
    if (input.makeCover) {
      await this.setCover({ vehicleId: input.vehicleId, url });
    } else {
      await this.syncVehicleImages(input.vehicleId);
    }
  },

  async addAssets(input: {
    vehicleId: string;
    album: string;
    urls: string[];
    makeCover?: boolean;
    countsForPublish?: boolean;
  }): Promise<void> {
    const album = normalizeAlbumName(input.album);
    if (!album) throw new Error("Álbum inválido");
    const urls = (input.urls ?? []).map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;

    const current = await this.listByVehicle(input.vehicleId);
    const maxSort = current
      .filter((a) => a.album === album)
      .reduce((m, a) => Math.max(m, Number(a.sort_order || 0)), 0);

    const tenantId = await resolveVehicleTenantId(input.vehicleId);
    const countsForPublish = input.countsForPublish ?? true;
    const rows = urls.map((url, idx) => ({
      tenant_id: tenantId,
      vehicle_id: input.vehicleId,
      album,
      url,
      sort_order: maxSort + idx + 1,
      is_cover: false,
      counts_for_publish: countsForPublish,
    }));

    const { error } = await supabase.from("vehicle_photo_assets").insert(rows as any);
    if (error) throw error;

    if (input.makeCover) {
      await this.setCover({ vehicleId: input.vehicleId, url: urls[0] });
    }

    await this.syncVehicleImages(input.vehicleId);
  },

  async renameAlbum(input: { vehicleId: string; from: string; to: string }) {
    const from = normalizeAlbumName(input.from);
    const to = normalizeAlbumName(input.to);
    if (!from || !to) throw new Error("Nombre de álbum inválido");
    if (from === to) return;

    const { error } = await supabase
      .from("vehicle_photo_assets")
      .update({ album: to } as any)
      .eq("vehicle_id", input.vehicleId)
      .eq("album", from);
    if (error) throw error;
  },

  async deleteAlbum(input: { vehicleId: string; album: string }) {
    const album = normalizeAlbumName(input.album);
    if (!album) return;
    const { error } = await supabase
      .from("vehicle_photo_assets")
      .delete()
      .eq("vehicle_id", input.vehicleId)
      .eq("album", album);
    if (error) throw error;
    await this.syncVehicleImages(input.vehicleId);
  },

  async deleteAsset(input: { id: string; vehicleId: string }) {
    const { error } = await supabase.from("vehicle_photo_assets").delete().eq("id", input.id);
    if (error) throw error;
    await this.syncVehicleImages(input.vehicleId);
  },

  async setCover(input: { vehicleId: string; url: string }) {
    // 1) reset covers
    await supabase
      .from("vehicle_photo_assets")
      .update({ is_cover: false } as any)
      .eq("vehicle_id", input.vehicleId);

    // 2) set cover for the first matching url
    const { error } = await supabase
      .from("vehicle_photo_assets")
      .update({ is_cover: true } as any)
      .eq("vehicle_id", input.vehicleId)
      .eq("url", input.url);
    if (error) throw error;
    await this.syncVehicleImages(input.vehicleId);
  },

  /** Flatten de assets → vehicles.images (portada primero; primary_image_url es columna generada). */
  async syncVehicleImages(vehicleId: string) {
    const assets = await this.listByVehicle(vehicleId);
    const urls = flattenVehicleImageUrls(assets);
    await vehicleService.update(vehicleId, { images: urls as any });
  },

  async listAlbumsSummary(vehicleId: string): Promise<VehiclePhotoAlbumSummary[]> {
    const assets = await this.listByVehicle(vehicleId);
    const byAlbum = new Map<string, VehiclePhotoAsset[]>();
    for (const a of assets) {
      const key = a.album || "Sin álbum";
      const list = byAlbum.get(key) ?? [];
      list.push(a);
      byAlbum.set(key, list);
    }
    return [...byAlbum.entries()]
      .map(([album, list]) => ({
        album,
        count: list.length,
        publishableCount: countPublishableAlbumPhotos(list),
        coverUrl: albumCoverUrl(list),
        isReferenceAlbum: album === CONSIGNMENT_REFERENCE_ALBUM,
      }))
      .sort((a, b) => a.album.localeCompare(b.album));
  },
};

