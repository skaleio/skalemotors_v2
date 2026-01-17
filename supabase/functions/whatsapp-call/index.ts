import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizePhone(phone: unknown): string {
  const s = String(phone ?? "").trim();
  if (!s) throw new Error("Missing phone");
  const cleaned = s.startsWith("+")
    ? "+" + s.slice(1).replace(/[^\d]/g, "")
    : s.replace(/[^\d]/g, "");
  return cleaned;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Missing auth" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const to = normalizePhone(b.to);
  const inboxId = String(b.inbox_id ?? "").trim() || null;

  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { ok: false, error: "Invalid auth" });
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await admin
    .from("users")
    .select("id, branch_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  const branchId = profile?.branch_id ?? null;

  // Determinar inbox
  let resolvedInboxId = inboxId;
  if (!resolvedInboxId) {
    const { data: inbox } = await admin
      .from("whatsapp_inboxes")
      .select("id")
      .eq("branch_id", branchId)
      .maybeSingle();
    resolvedInboxId = inbox?.id ?? null;
  }

  // Configuración YCloud para llamadas
  const ycloudBase = Deno.env.get("YCLOUD_API_BASE") || "https://api.ycloud.com";
  const ycloudAuthHeader = Deno.env.get("YCLOUD_AUTH_HEADER") || "X-API-Key";
  const ycloudAuthValue = Deno.env.get("YCLOUD_AUTH_VALUE") || Deno.env.get("YCLOUD_API_KEY") || "";
  const ycloudFrom = Deno.env.get("YCLOUD_WHATSAPP_FROM") || "";

  if (!ycloudAuthValue) {
    return jsonResponse(500, { ok: false, error: "Missing YCLOUD auth env vars" });
  }

  // Endpoint para iniciar llamada (ajusta según la API de tu proveedor)
  // Nota: El endpoint exacto puede variar según tu proveedor BSP
  const callPath = Deno.env.get("YCLOUD_CALL_PATH") || "/v2/whatsapp/calls";
  const url = `${ycloudBase.replace(/\/$/, "")}${callPath}`;

  const callPayload = {
    from: ycloudFrom || undefined,
    to,
    type: "voice",
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [ycloudAuthHeader]: ycloudAuthValue,
      },
      body: JSON.stringify(callPayload),
    });

    const respText = await resp.text();
    let respJson: unknown = null;
    try {
      respJson = JSON.parse(respText);
    } catch {
      // Si no es JSON, usar el texto
    }

    if (!resp.ok) {
      return jsonResponse(resp.status, {
        ok: false,
        error: `YCloud error: ${resp.status} ${resp.statusText}`,
        details: respJson,
      });
    }

    const callId = (respJson as Record<string, unknown>)?.id || 
                   (respJson as Record<string, unknown>)?.call_id || 
                   `call_${Date.now()}`;

    // Guardar en la base de datos
    const { data: callData, error: dbError } = await admin
      .from("whatsapp_calls")
      .insert({
        call_id: String(callId),
        contact_phone: to,
        direction: "saliente",
        status: "iniciando",
        user_id: userId,
        branch_id: branchId,
        inbox_id: resolvedInboxId,
        provider_call_id: String(callId),
        raw_payload: respJson as Record<string, unknown>,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving call to DB:", dbError);
      // Continuar aunque falle el guardado
    }

    return jsonResponse(200, {
      ok: true,
      call_id: callId,
      call: callData,
    });
  } catch (error) {
    console.error("Error calling YCloud:", error);
    return jsonResponse(500, {
      ok: false,
      error: "Failed to initiate call",
      details: String(error),
    });
  }
}
