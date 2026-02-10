import { supabase } from "../supabase";

export type MarketplacePlatform = "mercadolibre" | "facebook" | "chileautos";

export type MarketplaceConnectionRow = {
  id: string;
  branch_id: string;
  platform: MarketplacePlatform;
  status: "active" | "inactive" | "error";
  last_error: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VehicleListingRow = {
  id: string;
  vehicle_id: string;
  platform: MarketplacePlatform;
  external_id: string | null;
  external_url: string | null;
  status: "draft" | "published" | "paused" | "error" | "syncing";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

/** Listar conexiones de la sucursal del usuario (sin exponer credentials) */
export async function listConnections(branchId: string) {
  const { data, error } = await supabase
    .from("marketplace_connections")
    .select("id, branch_id, platform, status, last_error, last_sync_at, created_at, updated_at")
    .eq("branch_id", branchId)
    .order("platform");
  if (error) throw error;
  return data as MarketplaceConnectionRow[];
}

/** Conectar una plataforma (envía credenciales a Edge Function) */
export async function connectPlatform(
  platform: MarketplacePlatform,
  branchId: string,
  credentials: Record<string, string>
) {
  const { data, error } = await supabase.functions.invoke("marketplace-connect", {
    body: { platform, branch_id: branchId, credentials },
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al conectar");
  }
  return data as { ok: true; message: string };
}

/** Publicar un vehículo en una plataforma */
export async function publishVehicle(vehicleId: string, platform: MarketplacePlatform) {
  const { data, error } = await supabase.functions.invoke("marketplace-publish", {
    body: { vehicle_id: vehicleId, platform },
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al publicar");
  }
  return data as { ok: true; external_id?: string; external_url?: string };
}

/** Sincronizar todos los vehículos disponibles con las conexiones activas */
export async function syncAll(branchId?: string) {
  const { data, error } = await supabase.functions.invoke("marketplace-sync", {
    body: branchId ? { branch_id: branchId } : {},
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al sincronizar");
  }
  return data as { ok: true; synced: number; total_attempts?: number; errors?: Array<{ vehicle_id: string; platform: string; error: string }> };
}

/** Listados por vehículo (para Inventario) o todos con datos de vehículo (para Listings) */
export async function listListingsByVehicle(vehicleId: string) {
  const { data, error } = await supabase
    .from("vehicle_listings")
    .select("*")
    .eq("vehicle_id", vehicleId);
  if (error) throw error;
  return data as VehicleListingRow[];
}

/** Todos los listados de la sucursal con datos del vehículo */
export async function listListingsWithVehicles(branchId: string) {
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id")
    .eq("branch_id", branchId);
  const ids = (vehicles ?? []).map((v) => v.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("vehicle_listings")
    .select("id, vehicle_id, platform, external_id, external_url, status, last_synced_at, last_error, created_at, updated_at, payload_sent, vehicles(id, make, model, year, vin, price, status)")
    .in("vehicle_id", ids)
    .order("last_synced_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as (VehicleListingRow & {
    vehicles: { id: string; make: string; model: string; year: number; vin: string; price: number; status: string } | null;
  })[];
}

/** Listados simples por branch (para contar y mostrar en tabla sin join) */
export async function listListingsForBranch(vehicleIds: string[]) {
  if (vehicleIds.length === 0) return [];
  const { data, error } = await supabase
    .from("vehicle_listings")
    .select("*")
    .in("vehicle_id", vehicleIds);
  if (error) throw error;
  return (data ?? []) as VehicleListingRow[];
}
