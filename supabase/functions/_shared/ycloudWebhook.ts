import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AnyRecord = Record<string, unknown>;

export function asRecord(v: unknown): AnyRecord {
  return typeof v === "object" && v !== null ? (v as AnyRecord) : {};
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function normalizePhone(phone: unknown): string | null {
  if (!phone) return null;
  const s = String(phone).trim();
  if (!s) return null;
  const cleaned = s.startsWith("+")
    ? "+" + s.slice(1).replace(/[^\d]/g, "")
    : s.replace(/[^\d]/g, "");
  return cleaned.length >= 8 ? cleaned : s.replace(/[^\d]/g, "");
}

export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** YCloud-Signature: t=1654084800,s=hex */
export async function verifyYCloudSignature(
  secret: string,
  rawBody: string,
  header: string | null,
): Promise<boolean> {
  if (!secret || !header) return false;
  const parts = header.split(",").map((p) => p.trim());
  let timestamp = "";
  let signature = "";
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v ?? "";
    if (k === "s") signature = v ?? "";
  }
  if (!timestamp || !signature) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return timingSafeEqualHex(expected, signature);
}

export function parseTimestampToIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") {
    const ms = v < 1_000_000_000_000 ? v * 1000 : v;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export type InboxRoute = {
  inboxId: string | null;
  branchId: string | null;
  tenantId: string | null;
};

export async function resolveYCloudInbox(
  supabase: SupabaseClient,
  phoneNumberId: string | null,
): Promise<InboxRoute> {
  if (!phoneNumberId) {
    return { inboxId: null, branchId: null, tenantId: null };
  }
  const { data: inbox } = await supabase
    .from("whatsapp_inboxes")
    .select("id, branch_id, tenant_id")
    .eq("provider", "ycloud")
    .eq("provider_phone_number_id", String(phoneNumberId))
    .eq("is_active", true)
    .maybeSingle();

  return {
    inboxId: inbox?.id ?? null,
    branchId: inbox?.branch_id ?? null,
    tenantId: inbox?.tenant_id ?? null,
  };
}

export async function loadTenantYCloudWebhookSecret(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("tenant_ycloud_config")
    .select("webhook_secret")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  return (data?.webhook_secret as string | null) ?? null;
}

export type ParsedYCloudMessage = {
  phoneNumberId: string | null;
  contactPhone: string | null;
  contactName: string | null;
  content: string;
  direction: "entrante" | "saliente";
  status: "enviado" | "entregado" | "leido" | "fallido";
  sentAt: string;
  providerMessageId: string | null;
  isStatusUpdateOnly: boolean;
  statusTargetMessageId: string | null;
};

function mapYCloudStatus(raw: string): ParsedYCloudMessage["status"] {
  const s = raw.toLowerCase();
  if (s === "read") return "leido";
  if (s === "delivered") return "entregado";
  if (s === "failed") return "fallido";
  return "enviado";
}

function extractTextFromMessage(msg: AnyRecord): string {
  const text = asRecord(msg.text);
  if (text.body) return String(text.body);
  const type = String(msg.type ?? "").toLowerCase();
  if (type && type !== "text") return `[${type}]`;
  return "";
}

/** Extrae phoneNumberId y mensaje normalizado según type del evento YCloud. */
export function parseYCloudEvent(event: AnyRecord): ParsedYCloudMessage | null {
  const type = String(event.type ?? "");

  if (type === "whatsapp.inbound_message.received") {
    const inbound = asRecord(event.whatsappInboundMessage ?? event.inboundMessage);
    const from = normalizePhone(inbound.from ?? inbound.customerPhone ?? inbound.waId);
    return {
      phoneNumberId: String(inbound.phoneNumberId ?? inbound.phone_number_id ?? "") || null,
      contactPhone: from,
      contactName: inbound.customerProfile?.name
        ? String(asRecord(inbound.customerProfile).name)
        : null,
      content: extractTextFromMessage(inbound).slice(0, 10000),
      direction: "entrante",
      status: "enviado",
      sentAt: parseTimestampToIso(inbound.sendTime ?? inbound.createTime) ??
        new Date().toISOString(),
      providerMessageId: String(inbound.wamid ?? inbound.id ?? "") || null,
      isStatusUpdateOnly: false,
      statusTargetMessageId: null,
    };
  }

  if (type === "whatsapp.smb.message.echoes") {
    const echo = asRecord(event.whatsappSmbMessageEcho ?? event.smbMessageEcho);
    const to = normalizePhone(echo.to ?? echo.customerPhone);
    return {
      phoneNumberId: String(echo.phoneNumberId ?? "") || null,
      contactPhone: to,
      contactName: null,
      content: extractTextFromMessage(echo).slice(0, 10000),
      direction: "saliente",
      status: "enviado",
      sentAt: parseTimestampToIso(echo.sendTime ?? echo.timestamp) ?? new Date().toISOString(),
      providerMessageId: String(echo.wamid ?? echo.id ?? "") || null,
      isStatusUpdateOnly: false,
      statusTargetMessageId: null,
    };
  }

  if (type === "whatsapp.message.updated") {
    const wm = asRecord(event.whatsappMessage);
    return {
      phoneNumberId: String(wm.phoneNumberId ?? wm.from ?? "") || null,
      contactPhone: normalizePhone(wm.to ?? wm.customerPhone),
      contactName: null,
      content: "",
      direction: "saliente",
      status: mapYCloudStatus(String(wm.status ?? "sent")),
      sentAt: parseTimestampToIso(wm.sendTime ?? wm.updateTime) ?? new Date().toISOString(),
      providerMessageId: String(wm.wamid ?? wm.id ?? "") || null,
      isStatusUpdateOnly: true,
      statusTargetMessageId: String(wm.wamid ?? wm.id ?? "") || null,
    };
  }

  if (type === "whatsapp.smb.history") {
    const history = asRecord(event.whatsappSmbHistory ?? event.smbHistory);
    const messages = asArray(history.messages ?? history.data);
    const first = messages[0] ? asRecord(messages[0]) : null;
    if (!first) return null;
    return {
      phoneNumberId: String(history.phoneNumberId ?? first.phoneNumberId ?? "") || null,
      contactPhone: normalizePhone(first.from ?? first.to),
      contactName: null,
      content: extractTextFromMessage(first).slice(0, 10000),
      direction: String(first.direction ?? "").toLowerCase() === "outbound"
        ? "saliente"
        : "entrante",
      status: "enviado",
      sentAt: parseTimestampToIso(first.sendTime ?? first.timestamp) ?? new Date().toISOString(),
      providerMessageId: String(first.wamid ?? first.id ?? "") || null,
      isStatusUpdateOnly: false,
      statusTargetMessageId: null,
    };
  }

  return null;
}

export function extractPhoneNumberIdFromEvent(event: AnyRecord): string | null {
  const parsed = parseYCloudEvent(event);
  if (parsed?.phoneNumberId) return parsed.phoneNumberId;

  const wm = asRecord(event.whatsappMessage);
  if (wm.phoneNumberId) return String(wm.phoneNumberId);
  const inbound = asRecord(event.whatsappInboundMessage);
  if (inbound.phoneNumberId) return String(inbound.phoneNumberId);
  return null;
}
