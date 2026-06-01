import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/types/database";
import { vehicleService } from "@/lib/services/vehicles";

export type VehiclePhotoAsset =
  Database["public"]["Tables"]["vehicle_photo_assets"]["Row"];

export type VehiclePhotoAlbumSummary = {
  album: string;
  count: number;
  coverUrl: string | null;
};

function normalizeAlbumName(raw: string): string {
  return raw.trim();
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

  async addAssets(input: {
    vehicleId: string;
    album: string;
    urls: string[];
    makeCover?: boolean;
  }): Promise<void> {
    const album = normalizeAlbumName(input.album);
    if (!album) throw new Error("Álbum inválido");
    const urls = (input.urls ?? []).map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;

    const current = await this.listByVehicle(input.vehicleId);
    const maxSort = current
      .filter((a) => a.album === album)
      .reduce((m, a) => Math.max(m, Number(a.sort_order || 0)), 0);

    const rows = urls.map((url, idx) => ({
      vehicle_id: input.vehicleId,
      album,
      url,
      sort_order: maxSort + idx + 1,
      is_cover: false,
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

  /** Flatten de assets → vehicles.images (cover primero). */
  async syncVehicleImages(vehicleId: string) {
    const assets = await this.listByVehicle(vehicleId);
    const cover = assets.filter((a) => a.is_cover);
    const rest = assets.filter((a) => !a.is_cover);
    const urls = [...cover, ...rest].map((a) => a.url).filter(Boolean);
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
        coverUrl: list.find((x) => x.is_cover)?.url ?? list[0]?.url ?? null,
      }))
      .sort((a, b) => a.album.localeCompare(b.album));
  },
};

