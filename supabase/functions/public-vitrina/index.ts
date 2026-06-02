// public-vitrina — Lectura pública de la vitrina por hostname (sin auth).
//
// Único portón público hacia los datos de un tenant. Resuelve el tenant a partir
// del hostname (tabla tenant_domains, solo dominios verificados), y devuelve SOLO
// datos públicos: config del sitio, sucursales y autos publicados. Nunca expone
// campos sensibles (cost, margin, owner_*, documents, vin) ni datos de otros tenants.
//
// El tenant_id JAMÁS viene del cliente: se deriva del hostname server-side.
//
// Rutas (query param `path`):
//   - "site"            -> { site, branches }
//   - "vehicles"        -> { vehicles: [...] }   (listado)
//   - "vehicle"&id=...  -> { vehicle }           (ficha)
//   - (default)         -> { site, branches, vehicles } (home: trae todo acotado)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const PUBLIC_VEHICLE_COLUMNS =
  "id, make, model, year, color, mileage, fuel_type, transmission, transmision_display, " +
  "combustible_display, engine_size, doors, seats, category, condition, price, description, " +
  "features, images, primary_image_url, carroceria, branch_id, created_at";

function getEnvAny(names: string[]): string | null {
  for (const name of names) {
    const v = Deno.env.get(name);
    if (v) return v;
  }
  return null;
}

function normalizeHost(raw: string | null): string | null {
  if (!raw) return null;
  let host = raw.trim().toLowerCase();
  if (!host) return null;
  // quitar puerto y path accidental
  host = host.split("/")[0].split(":")[0];
  // www. y no-www se tratan como el mismo dominio en la búsqueda (probamos ambos)
  return host || null;
}

export default async function handler(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        // Cache en CDN/ISR: respuestas públicas cacheables por 60s, stale 5min.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
  const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase env vars" });
  }

  const url = new URL(req.url);
  // El hostname llega explícito por query (lo manda la app vitrina SSR) o por header.
  const host = normalizeHost(
    url.searchParams.get("host") ??
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host"),
  );
  if (!host) return json(400, { error: "Missing host" });

  const path = (url.searchParams.get("path") ?? "home").toLowerCase();
  const vehicleId = url.searchParams.get("id");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1. Resolver tenant por hostname (verificado). Probamos host y su variante www/no-www.
  const candidates = host.startsWith("www.")
    ? [host, host.slice(4)]
    : [host, `www.${host}`];

  const { data: domainRow, error: domainErr } = await admin
    .from("tenant_domains")
    .select("tenant_id, verification_status")
    .in("domain", candidates)
    .eq("verification_status", "verified")
    .limit(1)
    .maybeSingle();

  if (domainErr) return json(500, { error: "Resolve error" });
  if (!domainRow?.tenant_id) return json(404, { error: "Site not found" });

  const tenantId = domainRow.tenant_id as string;

  // 2. Config del sitio (debe estar publicado)
  const { data: site } = await admin
    .from("tenant_sites")
    .select(
      "is_published, theme, site_name, logo_url, favicon_url, font, primary_color, secondary_color, theme_custom, " +
        "hero_title, hero_subtitle, hero_image_url, about_text, whatsapp_phone, " +
        "contact_email, contact_phone, address, social, sections, videos, " +
        "seo_title, seo_description",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!site || site.is_published !== true) {
    return json(404, { error: "Site not published" });
  }

  // Ficha de un auto puntual
  if (path === "vehicle") {
    if (!vehicleId) return json(400, { error: "Missing id" });
    const { data: vehicle } = await admin
      .from("vehicles")
      .select(PUBLIC_VEHICLE_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("id", vehicleId)
      .eq("publicado_web", true)
      .eq("status", "disponible")
      .maybeSingle();
    if (!vehicle) return json(404, { error: "Vehicle not found" });
    return json(200, { vehicle });
  }

  // Sucursales públicas (datos de contacto, sin info sensible)
  const branchesPromise = admin
    .from("branches")
    .select("id, name, address, phone, email, city, region, opening_hours")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  // Listado de autos publicados y disponibles
  const vehiclesPromise = admin
    .from("vehicles")
    .select(PUBLIC_VEHICLE_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("publicado_web", true)
    .eq("status", "disponible")
    .order("created_at", { ascending: false });

  if (path === "vehicles") {
    const { data: vehicles } = await vehiclesPromise;
    return json(200, { vehicles: vehicles ?? [] });
  }

  if (path === "site") {
    const { data: branches } = await branchesPromise;
    return json(200, { site, branches: branches ?? [] });
  }

  // home (default): todo acotado
  const [{ data: branches }, { data: vehicles }] = await Promise.all([
    branchesPromise,
    vehiclesPromise,
  ]);
  return json(200, { site, branches: branches ?? [], vehicles: vehicles ?? [] });
}

Deno.serve((req) => handler(req));
