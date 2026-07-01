// vitrina-lead — Captura de leads desde la vitrina pública (sin auth).
//
// Recibe el formulario de contacto / "consultar por este auto" de la vitrina,
// resuelve el tenant por hostname y crea un lead en el CRM existente (tabla leads).
// El tenant_id JAMÁS viene del cliente. Anti-spam: honeypot + validación + dedup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { enforceRateLimit, getClientIp } from "../_shared/rateLimit.ts";

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
  host = host.split("/")[0].split(":")[0];
  return host || null;
}

function cleanPhone(phone: unknown): string | null {
  if (!phone) return null;
  const s = String(phone).trim();
  const digits = s.replace(/[^\d+]/g, "");
  return digits.length >= 8 ? digits : null;
}

function str(v: unknown, max = 2000): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

// Sanea un nombre: descarta emojis/símbolos/control chars, colapsa espacios
// y aplica Title Case. Devuelve "" si no queda nada útil.
function sanitizeName(v: unknown, max = 200): string {
  if (v === null || v === undefined) return "";
  const cleaned = String(v)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default async function handler(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
  const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase env vars" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  // Honeypot: campo oculto que un humano deja vacío. Si viene relleno -> bot.
  if (str(body.company) || str(body.website)) {
    // Respondemos ok para no dar pistas al bot, pero no insertamos nada.
    return json(200, { ok: true });
  }

  const url = new URL(req.url);
  const host = normalizeHost(
    (str(body.host)) ?? url.searchParams.get("host") ??
      req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );
  if (!host) return json(400, { error: "Missing host" });

  const fullName = sanitizeName(body.full_name, 200);
  const phone = cleanPhone(body.phone);
  const email = str(body.email, 200);
  const message = str(body.message, 2000);
  const vehicleId = str(body.vehicle_id, 64);

  if (!fullName) return json(400, { error: "full_name requerido" });
  if (!phone) return json(400, { error: "phone inválido" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Rate limit por IP: 20 req/min (anti-spam de captura de leads).
  const limited = await enforceRateLimit(
    admin,
    { identifier: getClientIp(req), route: "vitrina-lead", max: 20, windowSeconds: 60 },
    cors,
  );
  if (limited) return limited;

  // Resolver tenant por hostname verificado
  const candidates = host.startsWith("www.") ? [host, host.slice(4)] : [host, `www.${host}`];
  const { data: domainRow } = await admin
    .from("tenant_domains")
    .select("tenant_id")
    .in("domain", candidates)
    .eq("verification_status", "verified")
    .limit(1)
    .maybeSingle();

  if (!domainRow?.tenant_id) return json(404, { error: "Site not found" });
  const tenantId = domainRow.tenant_id as string;

  // Dedup anti-spam: mismo teléfono + tenant en los últimos 2 minutos -> ignorar.
  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (recent?.id) return json(200, { ok: true, deduped: true });

  // branch_id: el del vehículo consultado, si existe; si no, queda null (CRM lo asigna)
  let branchId: string | null = null;
  let preferredVehicleId: string | null = null;
  if (vehicleId) {
    const { data: vehicle } = await admin
      .from("vehicles")
      .select("id, branch_id")
      .eq("tenant_id", tenantId)
      .eq("id", vehicleId)
      .eq("publicado_web", true)
      .in("status", ["disponible", "reservado"])
      .maybeSingle();
    if (vehicle?.id) {
      preferredVehicleId = vehicle.id as string;
      branchId = (vehicle.branch_id as string | null) ?? null;
    }
  }

  const rawMessage = message
    ? message
    : preferredVehicleId
    ? `Consulta web por vehículo ${preferredVehicleId}`
    : "Consulta desde la vitrina web";

  const { error: insertErr } = await admin.from("leads").insert({
    tenant_id: tenantId,
    branch_id: branchId,
    full_name: fullName,
    phone,
    email,
    source: "web",
    status: "nuevo",
    priority: "media",
    raw_message: rawMessage,
    preferred_vehicle_id: preferredVehicleId,
  });

  if (insertErr) return json(500, { error: "No se pudo crear el lead" });

  return json(200, { ok: true });
}

Deno.serve((req) => handler(req));
