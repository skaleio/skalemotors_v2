import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

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
  state?: string;
  state_confidence?: number | string | null;
  state_reason?: string | null;
  state_updated_at?: string | null;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const expectedKey = Deno.env.get("LEAD_STATE_API_KEY");
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

  const leadId = body.lead_id?.trim();
  const state = body.state?.trim();
  if (!leadId || !state) {
    return jsonResponse(400, { ok: false, error: "lead_id and state are required" });
  }

  const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
  const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const stateConfidence = body.state_confidence === null || body.state_confidence === undefined
    ? null
    : Number(body.state_confidence);

  const stateUpdatedAt = body.state_updated_at?.trim() || new Date().toISOString();

  // Sincronizar pipeline: si state es un status válido del CRM, actualizar status para que el lead se mueva en el pipeline
  const validPipelineStatuses = ["nuevo", "contactado", "interesado", "cotizando", "negociando", "vendido", "perdido"];
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
    .select("id, state, state_confidence, state_reason, state_updated_at, status")
    .maybeSingle();

  if (error) {
    return jsonResponse(400, { ok: false, error: error.message });
  }

  return jsonResponse(200, { ok: true, data });
}
