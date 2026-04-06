import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnvAny(names: string[]): string | null {
  for (const name of names) {
    const v = Deno.env.get(name);
    if (v) return v;
  }
  return null;
}

function getApiKey(req: Request): string {
  return (
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(req.url).searchParams.get("api_key") ||
    ""
  );
}

function normalizePhoneChile(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("+56")) {
    const normalized = raw.replace(/^(\+56\s*)/g, "+56 ").trim();
    return normalized === "+56" ? "" : normalized;
  }
  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.startsWith("56") && digitsOnly.length >= 10) {
    const withoutCountry = digitsOnly.slice(2);
    return withoutCountry ? `+56 ${withoutCountry}` : "";
  }
  return `+56 ${raw}`;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const SOURCES = ["web", "referido", "walk_in", "telefono", "redes_sociales", "evento", "otro"] as const;
const PIPELINE_STATUSES = ["contactado", "negociando", "para_cierre"] as const;
const PRIORITIES = ["baja", "media", "alta"] as const;

type Payload = {
  branch_id?: string;
  full_name?: string;
  phone?: string;
  email?: string | null;
  status?: string;
  source?: string;
  priority?: string;
  notes?: string | null;
  region?: string | null;
  payment_type?: string | null;
  budget?: string | null;
  tags?: unknown;
  /** Si true y ya existe lead con mismo teléfono en la sucursal, actualiza en lugar de insertar. */
  update_existing?: boolean;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const expectedKey = Deno.env.get("LEAD_INGEST_API_KEY");
  if (expectedKey) {
    const provided = getApiKey(req);
    if (!provided || !provided.includes(expectedKey)) {
      return jsonResponse(401, { ok: false, error: "Invalid API key" });
    }
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const branchId = body.branch_id?.trim();
  if (!branchId) {
    return jsonResponse(400, { ok: false, error: "branch_id is required" });
  }

  const phoneRaw = body.phone?.trim() || "";
  const normalizedPhone = normalizePhoneChile(phoneRaw);
  if (!normalizedPhone) {
    return jsonResponse(400, { ok: false, error: "phone is required (valid Chile format)" });
  }

  const fullNameRaw = body.full_name?.trim() || "";
  const fullName = toTitleCase(fullNameRaw) || "Sin nombre";

  const status = body.status && PIPELINE_STATUSES.includes(body.status as typeof PIPELINE_STATUSES[number])
    ? body.status
    : "contactado";

  const source = body.source && SOURCES.includes(body.source as typeof SOURCES[number])
    ? body.source
    : "otro";

  const priority = body.priority && PRIORITIES.includes(body.priority as typeof PRIORITIES[number])
    ? body.priority
    : "media";

  let tagsForInsert: unknown[] = [];
  let tagsForUpdate: unknown[] | undefined;
  if (body.tags !== undefined && body.tags !== null) {
    if (!Array.isArray(body.tags)) {
      return jsonResponse(400, { ok: false, error: "tags must be an array when provided" });
    }
    tagsForInsert = body.tags;
    tagsForUpdate = body.tags;
  }

  const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
  const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, tenant_id")
    .eq("id", branchId)
    .maybeSingle();

  if (branchError) {
    return jsonResponse(400, { ok: false, error: branchError.message });
  }
  if (!branch) {
    return jsonResponse(400, { ok: false, error: "Invalid branch_id" });
  }

  const tenantId = branch.tenant_id ?? null;

  const updateExisting = body.update_existing === true;

  if (updateExisting) {
    const { data: existing, error: findError } = await supabase
      .from("leads")
      .select("id")
      .eq("branch_id", branchId)
      .eq("phone", normalizedPhone)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (findError) {
      return jsonResponse(400, { ok: false, error: findError.message });
    }

    if (existing?.id) {
      const updatePayload: Record<string, unknown> = {
        full_name: fullName,
        email: body.email !== undefined && body.email !== null ? String(body.email).trim() || null : undefined,
        status,
        source,
        priority,
        region: body.region !== undefined ? (body.region?.trim() || null) : undefined,
        payment_type: body.payment_type !== undefined ? (body.payment_type?.trim() || null) : undefined,
        budget: body.budget !== undefined ? (body.budget?.trim() || null) : undefined,
        notes: body.notes !== undefined ? (body.notes?.trim() || null) : undefined,
        updated_at: new Date().toISOString(),
      };
      if (tenantId) updatePayload.tenant_id = tenantId;
      if (tagsForUpdate !== undefined) updatePayload.tags = tagsForUpdate;

      Object.keys(updatePayload).forEach((k) => {
        if (updatePayload[k] === undefined) delete updatePayload[k];
      });

      const { data: updated, error: updError } = await supabase
        .from("leads")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("id, full_name, phone, status, branch_id, tenant_id, created_at, updated_at")
        .maybeSingle();

      if (updError) {
        return jsonResponse(400, { ok: false, error: updError.message });
      }

      return jsonResponse(200, { ok: true, created: false, data: updated });
    }
  }

  const insertPayload: Record<string, unknown> = {
    full_name: fullName,
    phone: normalizedPhone,
    email: body.email !== undefined && body.email !== null && String(body.email).trim()
      ? String(body.email).trim()
      : null,
    status,
    source,
    priority,
    branch_id: branchId,
    region: body.region?.trim() || null,
    payment_type: body.payment_type?.trim() || null,
    budget: body.budget?.trim() || null,
    notes: body.notes?.trim() || null,
    tags: tagsForInsert,
  };
  if (tenantId) insertPayload.tenant_id = tenantId;

  const { data: created, error: insertError } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id, full_name, phone, status, branch_id, tenant_id, created_at, updated_at")
    .single();

  if (insertError) {
    return jsonResponse(400, { ok: false, error: insertError.message });
  }

  return jsonResponse(200, { ok: true, created: true, data: created });
}
