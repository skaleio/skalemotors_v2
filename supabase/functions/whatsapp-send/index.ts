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

  // Auth: requiere JWT de Supabase (frontend llamará con supabase.functions.invoke)
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
  const text = String(b.text ?? "").trim();
  const inboxId = String(b.inbox_id ?? "").trim() || null;

  if (!text) return jsonResponse(400, { ok: false, error: "Missing text" });

  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Cliente para identificar usuario (con JWT del caller)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { ok: false, error: "Invalid auth" });
  }
  const userId = userData.user.id;

  // Cliente service-role para escribir y para consultar inbox/branch
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
      .eq("provider", "ycloud")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    resolvedInboxId = inbox?.id ?? null;
  }

  // ===========================
  // Enviar por YCloud
  // ===========================
  // Nota: Los detalles exactos del endpoint/headers pueden variar según tu cuenta YCloud.
  // Ajustes por env vars:
  // - YCLOUD_API_BASE (ej: https://api.ycloud.com)
  // - YCLOUD_AUTH_HEADER (ej: X-API-Key o Authorization)
  // - YCLOUD_AUTH_VALUE (ej: tu API key, o 'Bearer xxx')
  // - YCLOUD_WHATSAPP_FROM (tu número / sender / phone_number_id según requiera YCloud)
  const ycloudBase = Deno.env.get("YCLOUD_API_BASE") || "https://api.ycloud.com";
  const ycloudAuthHeader = Deno.env.get("YCLOUD_AUTH_HEADER") || "X-API-Key";
  const ycloudAuthValue = Deno.env.get("YCLOUD_AUTH_VALUE") || Deno.env.get("YCLOUD_API_KEY") ||
    "";
  const ycloudFrom = Deno.env.get("YCLOUD_WHATSAPP_FROM") || "";

  if (!ycloudAuthValue) {
    return jsonResponse(500, { ok: false, error: "Missing YCLOUD auth env vars" });
  }

  // Intento de endpoint “razonable”; si tu YCloud usa otro path, lo cambias en env `YCLOUD_SEND_PATH`.
  const sendPath = Deno.env.get("YCLOUD_SEND_PATH") || "/v2/whatsapp/messages";
  const url = `${ycloudBase.replace(/\/$/, "")}${sendPath}`;

  const ycloudPayload = {
    from: ycloudFrom || undefined,
    to,
    type: "text",
    text: { body: text },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [ycloudAuthHeader]: ycloudAuthValue,
    },
    body: JSON.stringify(ycloudPayload),
  });

  const respText = await resp.text();
  let respJson: unknown = null;
  try {
    respJson = JSON.parse(respText) as unknown;
  } catch {
    // ok
  }

  if (!resp.ok) {
    return jsonResponse(502, {
      ok: false,
      error: "YCloud send failed",
      details: respJson ?? respText,
    });
  }

  const r = (typeof respJson === "object" && respJson !== null)
    ? (respJson as Record<string, unknown>)
    : ({} as Record<string, unknown>);
  const rData = (typeof r.data === "object" && r.data !== null)
    ? (r.data as Record<string, unknown>)
    : ({} as Record<string, unknown>);
  const providerMessageId = (r.message_id ?? r.id ?? rData.message_id) ?? null;

  // Guardar en Supabase (saliente)
  const { error: insertErr } = await admin.from("messages").insert({
    type: "whatsapp",
    direction: "saliente",
    subject: null,
    content: text.slice(0, 10000),
    status: "enviado",
    sent_at: new Date().toISOString(),
    read_at: null,
    lead_id: null,
    user_id: userId,
    branch_id: branchId,
    inbox_id: resolvedInboxId,
    contact_phone: to,
    contact_name: null,
    provider: "ycloud",
    provider_message_id: providerMessageId ? String(providerMessageId) : null,
    raw_payload: respJson ?? { raw: respText },
  });

  if (insertErr) {
    // No rompemos el envío por un insert fallido, pero lo reportamos.
    return jsonResponse(200, {
      ok: true,
      sent: true,
      provider_message_id: providerMessageId,
      db_saved: false,
      db_error: insertErr.message,
    });
  }

  return jsonResponse(200, {
    ok: true,
    sent: true,
    provider_message_id: providerMessageId,
    inbox_id: resolvedInboxId,
  });
}


