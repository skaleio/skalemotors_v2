export const YCLOUD_API_BASE = "https://api.ycloud.com/v2";

/** Eventos mínimos para inbox + coexistencia en Skale. */
export const YCLOUD_WEBHOOK_EVENTS = [
  "whatsapp.inbound_message.received",
  "whatsapp.message.updated",
  "whatsapp.smb.message.echoes",
  "whatsapp.smb.history",
  "whatsapp.smb.app.state.sync",
] as const;

export function ycloudWebhookPublicUrl(): string | null {
  const explicit = Deno.env.get("YCLOUD_WEBHOOK_PUBLIC_URL")?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL");
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/ycloud-webhook`;
}

export async function validateYCloudPhoneNumber(
  apiKey: string,
  phoneNumberId: string,
): Promise<{ ok: boolean; error?: string; display_number?: string | null }> {
  const id = phoneNumberId.trim();
  const url = `${YCLOUD_API_BASE}/whatsapp/phoneNumbers/${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
  });

  const json = await res.json().catch(() => ({})) as {
    message?: string;
    phoneNumber?: string;
    displayPhoneNumber?: string;
  };

  if (!res.ok) {
    return { ok: false, error: json.message ?? res.statusText ?? "Invalid YCloud API key or phone number" };
  }

  return {
    ok: true,
    display_number: json.displayPhoneNumber ?? json.phoneNumber ?? null,
  };
}

export type YCloudWebhookEndpointResult = {
  ok: boolean;
  endpoint_id?: string;
  secret?: string;
  error?: string;
};

export async function registerYCloudWebhookEndpoint(
  apiKey: string,
  webhookUrl: string,
): Promise<YCloudWebhookEndpointResult> {
  const res = await fetch(`${YCLOUD_API_BASE}/webhookEndpoints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      url: webhookUrl,
      description: "Skale Motors WhatsApp",
      enabledEvents: [...YCLOUD_WEBHOOK_EVENTS],
      status: "active",
    }),
  });

  const json = await res.json().catch(() => ({})) as {
    id?: string;
    secret?: string;
    message?: string;
  };

  if (!res.ok) {
    return { ok: false, error: json.message ?? res.statusText };
  }

  return { ok: true, endpoint_id: json.id, secret: json.secret };
}

export type YCloudSendTextResult = {
  ok: boolean;
  providerMessageId: string | null;
  raw: unknown;
  error?: string;
};

export async function sendYCloudTextMessage(params: {
  apiKey: string;
  from: string;
  to: string;
  text: string;
}): Promise<YCloudSendTextResult> {
  const res = await fetch(`${YCLOUD_API_BASE}/whatsapp/messages/sendDirectly`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": params.apiKey,
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      type: "text",
      text: { body: params.text },
    }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof raw === "object" && raw !== null
        ? (raw as { message?: string }).message
        : undefined;
    return { ok: false, providerMessageId: null, raw, error: err ?? "YCloud send failed" };
  }

  const id =
    typeof raw === "object" && raw !== null
      ? String((raw as { id?: string; wamid?: string }).wamid ?? (raw as { id?: string }).id ?? "")
      : "";
  return { ok: true, providerMessageId: id || null, raw };
}
