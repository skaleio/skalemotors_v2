export const META_GRAPH_VERSION = "v21.0";

export function metaGraphUrl(path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `https://graph.facebook.com/${META_GRAPH_VERSION}/${p}`;
}

export function normalizePhone(phone: unknown): string {
  const s = String(phone ?? "").trim();
  if (!s) throw new Error("Missing phone");
  return s.startsWith("+")
    ? "+" + s.slice(1).replace(/[^\d]/g, "")
    : s.replace(/[^\d]/g, "");
}

export type WhatsAppPhoneValidation = {
  ok: boolean;
  error?: string;
  display_phone_number?: string | null;
  verified_name?: string | null;
  waba_id?: string | null;
};

/** Valida token + phone_number_id contra Graph API. */
export async function validateWhatsAppPhoneNumber(
  accessToken: string,
  phoneNumberId: string,
): Promise<WhatsAppPhoneValidation> {
  const id = phoneNumberId.trim();
  if (!id) return { ok: false, error: "phone_number_id is required" };

  const url =
    `${metaGraphUrl(id)}?fields=display_phone_number,verified_name,quality_rating`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const json = await res.json().catch(() => ({})) as {
    error?: { message?: string };
    display_phone_number?: string;
    verified_name?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: json.error?.message ?? res.statusText ?? "Invalid WhatsApp credentials",
    };
  }

  return {
    ok: true,
    display_phone_number: json.display_phone_number ?? null,
    verified_name: json.verified_name ?? null,
  };
}

export type SendWhatsAppTextResult = {
  ok: boolean;
  providerMessageId: string | null;
  raw: unknown;
  error?: string;
};

export async function sendWhatsAppTextMessage(params: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
}): Promise<SendWhatsAppTextResult> {
  const url = metaGraphUrl(`${params.phoneNumberId}/messages`);
  const metaPayload = {
    messaging_product: "whatsapp",
    to: params.to,
    type: "text",
    text: { body: params.text },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify(metaPayload),
  });

  const respText = await resp.text();
  let respJson: unknown = null;
  try {
    respJson = JSON.parse(respText);
  } catch {
    // ok
  }

  if (!resp.ok) {
    const errMsg =
      typeof respJson === "object" && respJson !== null
        ? (respJson as { error?: { message?: string } }).error?.message
        : undefined;
    return {
      ok: false,
      providerMessageId: null,
      raw: respJson ?? respText,
      error: errMsg ?? "Meta WhatsApp send failed",
    };
  }

  const providerMessageId =
    typeof respJson === "object" && respJson !== null
      ? ((respJson as Record<string, unknown>).messages as Array<{ id?: string }> | undefined)?.[0]?.id ?? null
      : null;

  return { ok: true, providerMessageId: providerMessageId ? String(providerMessageId) : null, raw: respJson };
}
