import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

const PLATFORMS = ["mercadolibre", "facebook", "chileautos"] as const;
type Platform = (typeof PLATFORMS)[number];

type PublishBody = { vehicle_id: string; platform: Platform };

type VehicleRow = {
  id: string;
  branch_id: string | null;
  make: string;
  model: string;
  year: number;
  color: string | null;
  mileage: number | null;
  price: number;
  description: string | null;
  images: unknown;
  status: string;
  category: string;
  condition: string | null;
  fuel_type: string | null;
  transmission: string | null;
};

function getImageUrls(images: unknown): string[] {
  if (Array.isArray(images)) return images.filter((x): x is string => typeof x === "string");
  if (images && typeof images === "object" && "url" in (images as Record<string, unknown>)) {
    const u = (images as { url: string }).url;
    return u ? [u] : [];
  }
  return [];
}

async function publishMercadoLibre(
  vehicle: VehicleRow,
  credentials: Record<string, string>
): Promise<{ ok: boolean; external_id?: string; external_url?: string; error?: string }> {
  const token = (credentials.access_token ?? credentials.accessToken ?? "").trim();
  if (!token) return { ok: false, error: "Missing access_token" };

  const title = `${vehicle.make} ${vehicle.model} ${vehicle.year}`.trim();
  const pictures = getImageUrls(vehicle.images).slice(0, 12).map((url) => ({ source: url }));
  if (pictures.length === 0) {
    pictures.push({ source: "https://via.placeholder.com/500x500?text=Sin+imagen" });
  }

  const body = {
    site_id: "MLC",
    category_id: "MLC1747",
    title,
    price: Number(vehicle.price) || 0,
    currency_id: "CLP",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    listing_type_id: "gold_special",
    condition: vehicle.category === "nuevo" ? "new" : "used",
    pictures,
    description: vehicle.description || title,
  };

  const res = await fetch("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || JSON.stringify(data) || res.statusText;
    return { ok: false, error: msg };
  }
  const id = data.id;
  const permalink = data.permalink;
  return { ok: true, external_id: id, external_url: permalink || (id ? `https://articulo.mercadolibre.cl/MLC-${id}` : undefined) };
}

async function publishFacebook(
  vehicle: VehicleRow,
  credentials: Record<string, string>
): Promise<{ ok: boolean; external_id?: string; external_url?: string; error?: string }> {
  const token = (credentials.access_token ?? credentials.accessToken ?? "").trim();
  const catalogId = (credentials.catalog_id ?? credentials.productCatalogId ?? "").trim();
  if (!token) return { ok: false, error: "Missing access_token" };
  if (!catalogId) return { ok: false, error: "Missing catalog_id" };

  const images = getImageUrls(vehicle.images);
  const body: Record<string, unknown> = {
    name: `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
    description: vehicle.description || `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
    price: `${Math.round(Number(vehicle.price) || 0)} CLP`,
    currency: "CLP",
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    vehicle_condition: vehicle.category === "nuevo" ? "new" : "used",
    exterior_color: vehicle.color || "No especificado",
    mileage: vehicle.mileage ? { value: vehicle.mileage, unit: "KILOMETERS" } : undefined,
    images: images.length ? images.map((url) => ({ url })) : undefined,
  };

  const res = await fetch(`https://graph.facebook.com/v18.0/${catalogId}/vehicles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.error?.error_user_msg || JSON.stringify(data) || res.statusText;
    return { ok: false, error: msg };
  }
  const id = data.id;
  return { ok: true, external_id: id, external_url: id ? `https://www.facebook.com/marketplace/item/${id}` : undefined };
}

async function getChileAutosToken(credentials: Record<string, string>): Promise<string | null> {
  const clientId = (credentials.client_id ?? credentials.clientId ?? "").trim();
  const clientSecret = (credentials.client_secret ?? credentials.clientSecret ?? "").trim();
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch("https://id.s.core.csnglobal.net/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.access_token ?? null;
}

async function publishChileAutos(
  vehicle: VehicleRow,
  credentials: Record<string, string>
): Promise<{ ok: boolean; external_id?: string; external_url?: string; error?: string }> {
  const token = await getChileAutosToken(credentials);
  if (!token) return { ok: false, error: "Could not get Chile Autos token" };

  const baseUrl = getEnv("CHILEAUTOS_API_URL") ?? "https://api.s.core.csnglobal.net";
  const sellerId = (credentials.seller_identifier ?? credentials.sellerIdentifier ?? "").trim();
  if (!sellerId) return { ok: false, error: "Missing seller_identifier" };

  const payload = {
    sellerIdentifier: sellerId,
    vehicles: [
      {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        price: Number(vehicle.price) || 0,
        mileage: vehicle.mileage ?? 0,
        color: vehicle.color ?? "",
        description: vehicle.description ?? "",
        images: getImageUrls(vehicle.images),
        condition: vehicle.condition ?? "bueno",
        fuelType: vehicle.fuel_type ?? "",
        transmission: vehicle.transmission ?? "",
      },
    ],
  };

  const res = await fetch(`${baseUrl}/inventory/v2/vehicles`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err || res.statusText };
  }
  const data = await res.json().catch(() => ({}));
  const id = data.vehicles?.[0]?.id ?? data.id ?? undefined;
  return {
    ok: true,
    external_id: id,
    external_url: id ? `https://www.chileautos.cl/vehiculo/${id}` : undefined,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Missing auth" });
  }

  let body: PublishBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const vehicleId = (body.vehicle_id ?? "").trim();
  const platform = body.platform?.toLowerCase();
  if (!vehicleId || !platform || !PLATFORMS.includes(platform as Platform)) {
    return jsonResponse(400, { ok: false, error: "vehicle_id and platform (mercadolibre|facebook|chileautos) required" });
  }

  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PROJECT_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { ok: false, error: "Invalid auth" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: vehicle, error: vehicleErr } = await admin
    .from("vehicles")
    .select("id, branch_id, make, model, year, color, mileage, price, description, images, status, category, condition, fuel_type, transmission")
    .eq("id", vehicleId)
    .single();

  if (vehicleErr || !vehicle) {
    return jsonResponse(404, { ok: false, error: "Vehicle not found" });
  }

  const branchId = (vehicle as VehicleRow).branch_id;
  if (!branchId) {
    return jsonResponse(400, { ok: false, error: "Vehicle has no branch" });
  }

  const { data: conn, error: connErr } = await admin
    .from("marketplace_connections")
    .select("id, credentials")
    .eq("branch_id", branchId)
    .eq("platform", platform)
    .eq("status", "active")
    .maybeSingle();

  if (connErr || !conn) {
    return jsonResponse(400, { ok: false, error: "No active connection for this platform. Connect the platform first in Publicaciones." });
  }

  const credentials = (conn.credentials as Record<string, string>) || {};
  let result: { ok: boolean; external_id?: string; external_url?: string; error?: string };

  try {
    if (platform === "mercadolibre") {
      result = await publishMercadoLibre(vehicle as VehicleRow, credentials);
    } else if (platform === "facebook") {
      result = await publishFacebook(vehicle as VehicleRow, credentials);
    } else {
      result = await publishChileAutos(vehicle as VehicleRow, credentials);
    }
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const listingPayload = {
    vehicle_id: vehicleId,
    platform,
    status: result.ok ? "published" : "error",
    external_id: result.external_id ?? null,
    external_url: result.external_url ?? null,
    last_synced_at: result.ok ? new Date().toISOString() : null,
    last_error: result.error ?? null,
    payload_sent: { title: `${vehicle.make} ${vehicle.model} ${vehicle.year}`, price: vehicle.price },
    updated_at: new Date().toISOString(),
  };

  await admin.from("vehicle_listings").upsert(
    { ...listingPayload, last_synced_at: listingPayload.last_synced_at ?? undefined },
    { onConflict: "vehicle_id,platform" }
  );

  if (result.ok) {
    await admin
      .from("marketplace_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
      .eq("branch_id", branchId)
      .eq("platform", platform);
  } else {
    await admin
      .from("marketplace_connections")
      .update({ last_error: result.error, updated_at: new Date().toISOString() })
      .eq("branch_id", branchId)
      .eq("platform", platform);
  }

  if (result.ok) {
    return jsonResponse(200, { ok: true, external_id: result.external_id, external_url: result.external_url });
  }
  return jsonResponse(400, { ok: false, error: result.error });
}
