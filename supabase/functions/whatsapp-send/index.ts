import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/authGuard.ts";
import {
  findActiveInboxForBranch,
  getLegacyGlobalCredentials,
  legacyGlobalWhatsAppEnabled,
  loadInboxCredentials,
  loadTenantYCloudApiKey,
  type WhatsAppInboxRow,
} from "../_shared/whatsappInbox.ts";
import { normalizePhone, sendWhatsAppTextMessage } from "../_shared/whatsappMeta.ts";
import { sendYCloudTextMessage } from "../_shared/ycloudApi.ts";

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

async function loadInboxById(
  admin: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  inboxId: string,
): Promise<WhatsAppInboxRow | null> {
  const { data } = await admin
    .from("whatsapp_inboxes")
    .select(
      "id, tenant_id, branch_id, provider, provider_phone_number_id, display_number, waba_id, status, is_active",
    )
    .eq("id", inboxId)
    .eq("is_active", true)
    .maybeSingle();
  return (data as WhatsAppInboxRow | null) ?? null;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const auth = await requireAuth(req, supabaseUrl, serviceRoleKey);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const to = normalizePhone(b.to);
  const text = String(b.text ?? "").trim();
  const inboxIdParam = String(b.inbox_id ?? "").trim() || null;

  if (!text) return jsonResponse(400, { ok: false, error: "Missing text" });

  const admin = auth.ctx.supabase;
  const userId = auth.ctx.user.id;

  const { data: profile } = await admin
    .from("users")
    .select("id, branch_id, tenant_id, legacy_protected")
    .eq("id", userId)
    .maybeSingle();

  const branchId = profile?.branch_id ?? null;
  const tenantId = profile?.tenant_id ?? auth.ctx.tenantId ?? null;

  let inbox: WhatsAppInboxRow | null = null;

  if (inboxIdParam) {
    inbox = await loadInboxById(admin, inboxIdParam);
    if (!inbox) {
      return jsonResponse(404, { ok: false, error: "Inbox no encontrado" });
    }
    // H3: siempre validar tenant del inbox (salvo legacy allowlist en authGuard).
    if (!auth.ctx.legacyProtected && tenantId && inbox.tenant_id && inbox.tenant_id !== tenantId) {
      return jsonResponse(403, { ok: false, error: "Inbox does not belong to your tenant" });
    }
    if (branchId && inbox.branch_id && inbox.branch_id !== branchId) {
      const role = auth.ctx.role ?? "";
      if (role !== "admin" && role !== "gerente" && role !== "jefe_jefe" && role !== "jefe_sucursal") {
        return jsonResponse(403, { ok: false, error: "Inbox does not belong to your branch" });
      }
    }
  } else if (branchId) {
    inbox = await findActiveInboxForBranch(admin, branchId);
  }

  if (inbox && inbox.status !== "active") {
    return jsonResponse(400, {
      ok: false,
      error: "WhatsApp no está conectado para esta sucursal. Ve a Integraciones.",
      code: "WHATSAPP_NOT_CONNECTED",
    });
  }

  let providerMessageId: string | null = null;
  let sendRaw: unknown = null;
  const resolvedInboxId = inbox?.id ?? null;
  const provider = inbox?.provider ?? "meta";

  if (inbox?.provider === "ycloud" && inbox.tenant_id) {
    const apiKey = await loadTenantYCloudApiKey(admin, inbox.tenant_id);
    if (!apiKey) {
      return jsonResponse(400, {
        ok: false,
        error: "Configura YCloud en Integraciones (API key del tenant).",
        code: "WHATSAPP_NOT_CONNECTED",
      });
    }
    const sendResult = await sendYCloudTextMessage({
      apiKey,
      from: inbox.provider_phone_number_id,
      to,
      text,
    });
    if (!sendResult.ok) {
      return jsonResponse(502, {
        ok: false,
        error: sendResult.error ?? "YCloud send failed",
        details: sendResult.raw,
      });
    }
    providerMessageId = sendResult.providerMessageId;
    sendRaw = sendResult.raw;
  } else if (inbox?.provider === "meta") {
    const creds = await loadInboxCredentials(admin, inbox.id);
    let accessToken = creds?.access_token ?? null;
    let phoneNumberId = inbox.provider_phone_number_id;

    if (!accessToken) {
      const legacy = profile?.legacy_protected || auth.ctx.legacyProtected
        ? getLegacyGlobalCredentials()
        : legacyGlobalWhatsAppEnabled()
          ? getLegacyGlobalCredentials()
          : null;
      if (legacy) {
        accessToken = legacy.accessToken;
        phoneNumberId = legacy.phoneNumberId;
      }
    }

    if (!accessToken || !phoneNumberId) {
      return jsonResponse(400, {
        ok: false,
        error: "Conecta WhatsApp en Integraciones antes de enviar mensajes.",
        code: "WHATSAPP_NOT_CONNECTED",
      });
    }

    const sendResult = await sendWhatsAppTextMessage({
      accessToken,
      phoneNumberId,
      to,
      text,
    });
    if (!sendResult.ok) {
      return jsonResponse(502, {
        ok: false,
        error: sendResult.error ?? "Meta WhatsApp send failed",
        details: sendResult.raw,
      });
    }
    providerMessageId = sendResult.providerMessageId;
    sendRaw = sendResult.raw;
  } else {
    const legacy = profile?.legacy_protected || auth.ctx.legacyProtected
      ? getLegacyGlobalCredentials()
      : legacyGlobalWhatsAppEnabled()
        ? getLegacyGlobalCredentials()
        : null;

    if (!legacy) {
      return jsonResponse(400, {
        ok: false,
        error: "Conecta WhatsApp en Integraciones antes de enviar mensajes.",
        code: "WHATSAPP_NOT_CONNECTED",
      });
    }

    const sendResult = await sendWhatsAppTextMessage({
      accessToken: legacy.accessToken,
      phoneNumberId: legacy.phoneNumberId,
      to,
      text,
    });
    if (!sendResult.ok) {
      return jsonResponse(502, {
        ok: false,
        error: sendResult.error ?? "Meta WhatsApp send failed",
        details: sendResult.raw,
      });
    }
    providerMessageId = sendResult.providerMessageId;
    sendRaw = sendResult.raw;
  }

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
    tenant_id: tenantId ?? inbox?.tenant_id ?? null,
    inbox_id: resolvedInboxId,
    contact_phone: to,
    contact_name: null,
    provider: inbox ? provider : "meta",
    provider_message_id: providerMessageId,
    raw_payload: sendRaw,
  });

  if (insertErr) {
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
    provider: inbox ? provider : "meta",
  });
}

Deno.serve((req) => handler(req));
