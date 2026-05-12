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

function getApiKey(req: Request) {
  return (
    req.headers.get("x-api-key") ||
    req.headers.get("authorization") ||
    new URL(req.url).searchParams.get("api_key") ||
    ""
  );
}

type Payload = {
  lead_id?: string;
  branch_id?: string;
  state?: string;
  state_confidence?: number | string | null;
  state_reason?: string | null;
  state_updated_at?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  // Parse early para tener branch_id disponible al validar la key per-branch.
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const leadId = body.lead_id?.trim();
  const branchId = body.branch_id?.trim();
  const state = body.state?.trim();
  if (!leadId || !state) {
    return jsonResponse(400, { ok: false, error: "lead_id and state are required" });
  }
  if (!leadId.match(UUID_RE)) {
    return jsonResponse(400, { ok: false, error: "lead_id must be a valid UUID" });
  }
  if (!branchId || !branchId.match(UUID_RE)) {
    return jsonResponse(400, { ok: false, error: "branch_id is required and must be a valid UUID" });
  }

  const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
  const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Auth: primero key per-branch via lead_ingest_keys (preferido).
  // Fallback temporal: LEAD_STATE_API_KEY global (rotación gradual con n8n).
  // Cuando n8n esté usando keys per-branch, eliminar el secret y este fallback.
  // Usamos fetch directo a PostgREST (no supabase.rpc) con timeout 5s para
  // evitar que un cuelgue del client bloquee la function entera (visto en v16).
  const provided = getApiKey(req).replace(/^Bearer\s+/i, "").trim();
  if (!provided) {
    return jsonResponse(401, { ok: false, error: "Missing API key" });
  }

  let perBranchOk = false;
  try {
    const verifyRes = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_lead_ingest_key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ p_key: provided, p_branch_id: branchId }),
      signal: AbortSignal.timeout(5000),
    });
    if (verifyRes.ok) {
      const verifyJson = (await verifyRes.json()) as { ok?: boolean } | null;
      perBranchOk = verifyJson?.ok === true;
    }
  } catch (_) {
    perBranchOk = false;
  }

  if (!perBranchOk) {
    const legacyKey = Deno.env.get("LEAD_STATE_API_KEY");
    const legacyOk = legacyKey && provided.includes(legacyKey);
    if (!legacyOk) {
      return jsonResponse(401, { ok: false, error: "Invalid API key" });
    }
  }

  const stateConfidence = body.state_confidence === null || body.state_confidence === undefined
    ? null
    : Number(body.state_confidence);

  const stateUpdatedAt = body.state_updated_at?.trim() || new Date().toISOString();

  // Sincronizar pipeline: si state es un status válido del CRM, actualizar status para que el lead se mueva en el pipeline
  const validPipelineStatuses = [
    "nuevo",
    "contactado",
    "interesado",
    "cotizando",
    "negociando",
    "para_cierre",
    "vendido",
    "perdido",
  ];
  const syncStatus = validPipelineStatuses.includes(state) ? state : null;

  const updatePayload: Record<string, unknown> = {
    state,
    state_confidence: Number.isNaN(stateConfidence) ? null : stateConfidence,
    state_reason: body.state_reason ?? null,
    state_updated_at: stateUpdatedAt,
    updated_at: new Date().toISOString(),
  };
  if (syncStatus) {
    updatePayload.status = syncStatus;
  }

  const { data, error } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", leadId)
    .eq("branch_id", branchId)
    .select("id, state, state_confidence, state_reason, state_updated_at, status")
    .maybeSingle();

  if (error) {
    return jsonResponse(400, { ok: false, error: error.message });
  }

  if (!data) {
    return jsonResponse(404, { ok: false, error: "lead not found for the provided branch_id" });
  }

  return jsonResponse(200, { ok: true, data });
}
