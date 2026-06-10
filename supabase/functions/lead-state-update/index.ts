/// <reference path="../_shared/edge-runtime.d.ts" />
// lead-state-update v19: usar Deno.serve() en lugar de `export default handler`.
//
// Razón: cuando verify_jwt:false, el runtime de Supabase Edge **no invoca**
// `export default async function handler` — la function queda colgada esperando
// hasta que el worker timeout dispara HTTP 546 (visto en v16/v17/v18 colgando 150s).
// Las functions que sí funcionan con verify_jwt:false (getapi-appraisal) usan
// el patrón Deno.serve(). Esto NO está en docs públicos pero es el comportamiento
// observado en prod.
//
// Adicionalmente: removido import de supabase-js para reducir cold-start y
// eliminar otra posible fuente de cuelgues. Usamos fetch directo a PostgREST
// tanto para verify_lead_ingest_key RPC como para el UPDATE final a leads.

import { corsHeaders } from "../_shared/cors.ts";
import { isProductionEnv } from "../_shared/env.ts";

function jsonResponse(status: number, body: unknown): Response {
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

const VALID_PIPELINE_STATUSES = new Set([
  "nuevo", "contactado", "interesado", "cotizando",
  "agendado", "negociando", "en_espera", "para_cierre", "vendido", "perdido", "cancelado",
]);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

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

  const provided = getApiKey(req).replace(/^Bearer\s+/i, "").trim();
  if (!provided) {
    return jsonResponse(401, { ok: false, error: "Missing API key" });
  }

  // Auth: 1) RPC verify_lead_ingest_key (per-branch). 2) fallback env LEAD_STATE_API_KEY.
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
    if (isProductionEnv()) {
      return jsonResponse(401, { ok: false, error: "Invalid API key" });
    }
    const legacyKey = Deno.env.get("LEAD_STATE_API_KEY");
    const legacyOk = legacyKey && provided.includes(legacyKey);
    if (!legacyOk) {
      return jsonResponse(401, { ok: false, error: "Invalid API key" });
    }
  }

  // UPDATE leads via PostgREST directo (sin supabase-js).
  const stateConfidence = body.state_confidence === null || body.state_confidence === undefined
    ? null
    : Number(body.state_confidence);
  const stateUpdatedAt = body.state_updated_at?.trim() || new Date().toISOString();
  const syncStatus = VALID_PIPELINE_STATUSES.has(state) ? state : null;

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

  try {
    const url = `${supabaseUrl}/rest/v1/leads?id=eq.${encodeURIComponent(leadId)}&branch_id=eq.${encodeURIComponent(branchId)}&select=id,state,state_confidence,state_reason,state_updated_at,status`;
    const updateRes = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(updatePayload),
      signal: AbortSignal.timeout(8000),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return jsonResponse(updateRes.status, { ok: false, error: errText.slice(0, 500) });
    }

    const rows = (await updateRes.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonResponse(404, { ok: false, error: "lead not found for the provided branch_id" });
    }

    return jsonResponse(200, { ok: true, data: rows[0] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse(500, { ok: false, error: msg });
  }
});
