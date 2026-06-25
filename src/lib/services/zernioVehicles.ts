import { supabase } from "../supabase";

export type PostableVehicle = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  patente: string | null;
  transmision_display: string | null;
  combustible_display: string | null;
  images: string[];
  primary_image_url: string | null;
  status: string;
};

const COLS =
  "id, make, model, year, price, mileage, patente, transmision_display, combustible_display, images, primary_image_url, status";

/**
 * Vehículos disponibles que aún NO se publicaron en redes (scope org) desde Skale.
 * "Ya posteado" = existe un zernio_posts.vehicle_id con status published/scheduled.
 * El tenant lo acota RLS; el rol debe poder leer posts org (ver migración fotografo).
 */
export async function listPostableVehicles(): Promise<PostableVehicle[]> {
  const { data: posted, error: postedErr } = await supabase
    .from("zernio_posts")
    .select("vehicle_id")
    .eq("scope", "org")
    .in("status", ["published", "scheduled"])
    .not("vehicle_id", "is", null);
  if (postedErr) throw new Error(postedErr.message);
  const postedIds = new Set((posted ?? []).map((r) => r.vehicle_id as string));

  const { data, error } = await supabase
    .from("vehicles")
    .select(COLS)
    .eq("status", "disponible")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((v) => !postedIds.has(v.id as string))
    .map((v) => ({
      id: v.id as string,
      make: (v.make as string) ?? null,
      model: (v.model as string) ?? null,
      year: (v.year as number) ?? null,
      price: (v.price as number) ?? null,
      mileage: (v.mileage as number) ?? null,
      patente: (v.patente as string) ?? null,
      transmision_display: (v.transmision_display as string) ?? null,
      combustible_display: (v.combustible_display as string) ?? null,
      images: Array.isArray(v.images) ? (v.images as string[]) : [],
      primary_image_url: (v.primary_image_url as string) ?? null,
      status: (v.status as string) ?? "",
    }));
}
