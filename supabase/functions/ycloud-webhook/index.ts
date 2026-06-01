import { corsHeaders } from "../_shared/cors.ts";
import {
  asRecord,
  extractPhoneNumberIdFromEvent,
  loadTenantYCloudWebhookSecret,
  parseYCloudEvent,
  resolveYCloudInbox,
  verifyYCloudSignature,
} from "../_shared/ycloudWebhook.ts";

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

async function resolveLeadId(
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  contactPhone: string | null,
  branchId: string | null,
) {
  if (!contactPhone) return null;
  try {
    let leadQuery = supabase
      .from("leads")
      .select("id")
      .eq("phone", contactPhone)
      .order("created_at", { ascending: false })
      .limit(1);
    if (branchId) leadQuery = leadQuery.eq("branch_id", branchId);
    const { data: lead } = await leadQuery.maybeSingle();
    return (lead?.id as string | null) ?? null;
  } catch {
    return null;
  }
}

async function postToN8n(url: string, token: string | null, payload: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-webhook-token": token } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // no bloquear
  } finally {
    clearTimeout(timeout);
  }
}

async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Method not allowed", request_id: requestId });
    }

    const rawBody = await req.text();
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return jsonResponse(200, { ok: true, ignored: true, reason: "invalid_json", request_id: requestId });
    }

    const phoneNumberId = extractPhoneNumberIdFromEvent(event);
    const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
    const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { ok: false, error: "Missing Supabase env", request_id: requestId });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const route = await resolveYCloudInbox(supabase, phoneNumberId);
    if (!route.inboxId || !route.tenantId) {
      console.warn("[ycloud-webhook] unknown phoneNumberId", phoneNumberId, requestId);
      return jsonResponse(200, {
        ok: true,
        ignored: true,
        reason: "unknown_inbox",
        request_id: requestId,
      });
    }

    const secret = await loadTenantYCloudWebhookSecret(supabase, route.tenantId);
    if (secret) {
      const sigHeader = req.headers.get("YCloud-Signature");
      const okSig = await verifyYCloudSignature(secret, rawBody, sigHeader);
      if (!okSig) {
        return jsonResponse(401, { ok: false, error: "Invalid YCloud-Signature", request_id: requestId });
      }
    }

    const parsed = parseYCloudEvent(event);
    if (!parsed) {
      return jsonResponse(200, { ok: true, ignored: true, reason: "unhandled_event", request_id: requestId });
    }

    if (parsed.isStatusUpdateOnly && parsed.statusTargetMessageId) {
      const { error: updErr } = await supabase
        .from("messages")
        .update({ status: parsed.status, sent_at: parsed.sentAt })
        .eq("provider", "ycloud")
        .eq("provider_message_id", parsed.statusTargetMessageId);

      return jsonResponse(200, {
        ok: true,
        updated: !updErr,
        request_id: requestId,
      });
    }

    if (!parsed.contactPhone && !parsed.content) {
      return jsonResponse(200, { ok: true, ignored: true, reason: "empty_message", request_id: requestId });
    }

    const leadId = await resolveLeadId(supabase, parsed.contactPhone, route.branchId);
    const n8nWebhookUrl = Deno.env.get("N8N_MESSAGE_WEBHOOK_URL");
    const n8nWebhookToken = Deno.env.get("N8N_MESSAGE_WEBHOOK_TOKEN");

    const { error: insertErr } = await supabase.from("messages").insert({
      type: "whatsapp",
      direction: parsed.direction,
      subject: null,
      content: parsed.content || "",
      status: parsed.status,
      sent_at: parsed.sentAt,
      read_at: parsed.status === "leido" ? parsed.sentAt : null,
      lead_id: leadId,
      user_id: null,
      branch_id: route.branchId,
      tenant_id: route.tenantId,
      inbox_id: route.inboxId,
      contact_phone: parsed.contactPhone,
      contact_name: parsed.contactName,
      provider: "ycloud",
      provider_message_id: parsed.providerMessageId,
      provider_status_id: null,
      raw_payload: event,
    });

    if (insertErr) {
      const msgTxt = String(insertErr.message || "");
      if (msgTxt.toLowerCase().includes("duplicate") || msgTxt.toLowerCase().includes("unique")) {
        return jsonResponse(200, { ok: true, duplicate: true, request_id: requestId });
      }
      console.error("[ycloud-webhook] insert error", insertErr.message, requestId);
      return jsonResponse(200, { ok: false, db_error: insertErr.message, request_id: requestId });
    }

    if (n8nWebhookUrl && parsed.direction === "entrante") {
      await postToN8n(n8nWebhookUrl, n8nWebhookToken, {
        event: "message.received",
        provider: "ycloud",
        provider_message_id: parsed.providerMessageId,
        direction: parsed.direction,
        contact_phone: parsed.contactPhone,
        contact_name: parsed.contactName,
        content: parsed.content,
        sent_at: parsed.sentAt,
        inbox_id: route.inboxId,
        branch_id: route.branchId,
        tenant_id: route.tenantId,
        lead_id: leadId,
      });
    }

    return jsonResponse(200, { ok: true, inserted: true, request_id: requestId });
  } catch (e) {
    console.error("[ycloud-webhook]", e, requestId);
    return jsonResponse(500, {
      ok: false,
      error: e instanceof Error ? e.message : "Internal error",
      request_id: requestId,
    });
  }
}

Deno.serve((req) => handler(req));
