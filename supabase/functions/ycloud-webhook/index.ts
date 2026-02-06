import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-token, x-signature, x-ycloud-signature, x-ycloud-token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

type WebhookResult = {
  ok: boolean;
  inserted?: number;
  updated?: number;
  ignored?: number;
  request_id?: string;
  error?: string;
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

function normalizePhone(phone: unknown): string | null {
  if (!phone) return null;
  const s = String(phone).trim();
  if (!s) return null;
  const cleaned = s.startsWith("+")
    ? "+" + s.slice(1).replace(/[^\d]/g, "")
    : s.replace(/[^\d]/g, "");
  return cleaned.length >= 8 ? cleaned : s;
}

type AnyRecord = Record<string, unknown>;

function asRecord(v: unknown): AnyRecord {
  return typeof v === "object" && v !== null ? (v as AnyRecord) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function parseTimestampToIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    const ms = v < 1_000_000_000_000 ? v * 1000 : v;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isNaN(n)) return parseTimestampToIso(n);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function extractEvents(payload: unknown): unknown[] {
  const p = asRecord(payload);
  const dataArr = asArray(p.data);
  if (dataArr.length) return dataArr.filter(Boolean);
  const eventsArr = asArray(p.events);
  if (eventsArr.length) return eventsArr.filter(Boolean);
  return (Array.isArray(payload) ? payload : [payload]).filter(Boolean);
}

function extractYCloudInbound(event: AnyRecord) {
  const inbound = asRecord(event.whatsappInboundMessage);
  if (!Object.keys(inbound).length) return null;
  const textObj = asRecord(inbound.text);
  const customerProfile = asRecord(inbound.customerProfile);

  return {
    providerMessageId: inbound.id ?? event.id ?? null,
    providerPhoneNumberId: inbound.wabaId ?? event.wabaId ?? null,
    from: normalizePhone(inbound.from),
    to: normalizePhone(inbound.to),
    text: (textObj.body as string | undefined) ?? "",
    timestamp: parseTimestampToIso(inbound.sendTime),
    contactName: (customerProfile.name as string | undefined) ?? null,
  };
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
    // No bloquear el webhook si n8n falla o se demora.
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();

  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const expectedToken = Deno.env.get("YCLOUD_WEBHOOK_TOKEN");
    if (expectedToken) {
      const tokenHeader =
        req.headers.get("x-webhook-token") ||
        req.headers.get("x-ycloud-token") ||
        req.headers.get("authorization");
      const tokenQuery = new URL(req.url).searchParams.get("token");
      const provided = tokenQuery || tokenHeader || "";
      if (!provided || !provided.includes(expectedToken)) {
        return jsonResponse(401, { ok: false, error: "Invalid webhook token", request_id: requestId });
      }
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON body", request_id: requestId });
    }

    const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
    const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, {
        ok: false,
        error: "Missing Supabase env vars",
        request_id: requestId,
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const n8nWebhookUrl = Deno.env.get("N8N_MESSAGE_WEBHOOK_URL");
    const n8nWebhookToken = Deno.env.get("N8N_MESSAGE_WEBHOOK_TOKEN");

    const events = extractEvents(payload);
    let inserted = 0;
    let updated = 0;
    let ignored = 0;

    for (const event of events) {
      try {
        const e = asRecord(event);

        const inbound = extractYCloudInbound(e);

        const messageObj = asRecord(e.message);
        const dataObj = asRecord(e.data);
        const metadataObj = asRecord(e.metadata);
        const contactObj = asRecord(e.contact);
        const profileObj = asRecord(e.profile);
        const deliveryObj = asRecord(e.delivery);
        const statusesArr = asArray(e.statuses);
        const firstStatus = asRecord(statusesArr[0]);

        const typeGuess = String(e.type ?? e.event ?? e.topic ?? "").toLowerCase();
        const isStatus =
          typeGuess.includes("status") ||
          e.status ||
          statusesArr.length > 0 ||
          e.message_status ||
          Object.keys(deliveryObj).length > 0;

        const provider = "ycloud";
        const providerMessageId =
          inbound?.providerMessageId ??
          e.message_id ?? e.id ?? messageObj.id ?? dataObj.message_id ?? null;
        const providerStatusId =
          e.status_id ?? firstStatus.id ?? deliveryObj.id ?? null;

        const from = inbound?.from ??
          normalizePhone(
            e.from ?? e.sender ?? messageObj.from ?? dataObj.from ?? contactObj.phone,
          );
        const to = inbound?.to ??
          normalizePhone(
            e.to ?? e.recipient ?? messageObj.to ?? dataObj.to ?? metadataObj.display_phone_number,
          );

        const dataMessageText = asRecord(dataObj.message).text as string | undefined;
        const text =
          inbound?.text ??
          e.text ??
          messageObj.text ??
          messageObj.body ??
          dataObj.text ??
          dataMessageText ??
          e.content ??
          "";

        const status =
          String(
            e.status ??
              e.message_status ??
              firstStatus.status ??
              deliveryObj.status ??
              "",
          ).toLowerCase();

        const timestamp =
          inbound?.timestamp ??
          parseTimestampToIso(
            e.timestamp ?? e.sent_at ?? e.created_at ?? messageObj.timestamp ?? dataObj.timestamp ?? null,
          );

        const providerPhoneNumberId =
          inbound?.providerPhoneNumberId ??
          e.phone_number_id ??
          metadataObj.phone_number_id ??
          dataObj.phone_number_id ??
          e.wa_phone_number_id ??
          null;

        let inboxId: string | null = null;
        let branchId: string | null = null;
        if (providerPhoneNumberId) {
          const { data: inbox } = await supabase
            .from("whatsapp_inboxes")
            .select("id, branch_id")
            .eq("provider", "ycloud")
            .eq("provider_phone_number_id", String(providerPhoneNumberId))
            .eq("is_active", true)
            .maybeSingle();

          inboxId = inbox?.id ?? null;
          branchId = inbox?.branch_id ?? null;
        }

        if (!inboxId && to) {
          const { data: inboxByNumber } = await supabase
            .from("whatsapp_inboxes")
            .select("id, branch_id")
            .eq("provider", "ycloud")
            .eq("display_number", String(to))
            .eq("is_active", true)
            .maybeSingle();

          inboxId = inboxByNumber?.id ?? inboxId;
          branchId = inboxByNumber?.branch_id ?? branchId;
        }

        const directionRaw = String(e.direction ?? "").toLowerCase();
        const direction =
          directionRaw.includes("out") || directionRaw.includes("send") || directionRaw === "saliente"
            ? "saliente"
            : "entrante";

        const contactPhone = direction === "saliente" ? (to || from) : (from || to);

        if (!contactPhone) {
          ignored++;
          continue;
        }

        let leadId: string | null = null;
        try {
          let leadQuery = supabase
            .from("leads")
            .select("id")
            .eq("phone", contactPhone)
            .order("created_at", { ascending: false })
            .limit(1);

          if (branchId) {
            leadQuery = leadQuery.eq("branch_id", branchId);
          }

          const { data: lead } = await leadQuery.maybeSingle();
          leadId = lead?.id ?? null;
        } catch {
          leadId = null;
        }

        if (isStatus && providerMessageId) {
          const mappedStatus =
            status.includes("read") || status.includes("leido") ? "leido"
              : status.includes("deliver") || status.includes("entregado") ? "entregado"
              : status.includes("fail") || status.includes("error") ? "fallido"
              : status ? "enviado"
              : null;

          const { error } = await supabase
            .from("messages")
            .update({
              status: mappedStatus ?? undefined,
              provider_status_id: providerStatusId ? String(providerStatusId) : undefined,
              raw_payload: event as unknown as AnyRecord,
            })
            .eq("type", "whatsapp")
            .eq("provider", provider)
            .eq("provider_message_id", String(providerMessageId));

          if (!error) updated++;
          else ignored++;
          continue;
        }

        const sentAt = timestamp ?? new Date().toISOString();

        const { error: insertErr } = await supabase.from("messages").insert({
          type: "whatsapp",
          direction,
          subject: null,
          content: String(text || "").slice(0, 10000),
          status: "enviado",
          sent_at: sentAt,
          read_at: null,
          lead_id: leadId,
          user_id: null,
          branch_id: branchId,
          inbox_id: inboxId,
          contact_phone: contactPhone,
          contact_name: inbound?.contactName
            ?? (contactObj.name as string | undefined)
            ?? (profileObj.name as string | undefined)
            ?? null,
          provider,
          provider_message_id: providerMessageId ? String(providerMessageId) : null,
          provider_status_id: providerStatusId ? String(providerStatusId) : null,
          raw_payload: event as unknown as AnyRecord,
        });

        if (insertErr) {
          const msg = String(insertErr.message || "");
          if (msg.includes("duplicate") || msg.includes("unique")) {
            ignored++;
          } else {
            ignored++;
          }
        } else {
          inserted++;
          if (n8nWebhookUrl) {
            await postToN8n(n8nWebhookUrl, n8nWebhookToken, {
              event: "message.received",
              provider,
              provider_message_id: providerMessageId,
              direction,
              contact_phone: contactPhone,
              contact_name: inbound?.contactName ?? null,
              content: String(text || ""),
              sent_at: sentAt,
              inbox_id: inboxId,
              branch_id: branchId,
              lead_id: leadId,
              raw: event,
            });
          }
        }
      } catch {
        ignored++;
      }
    }

    const result: WebhookResult = { ok: true, inserted, updated, ignored, request_id: requestId };
    return jsonResponse(200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unhandled error";
    return jsonResponse(500, { ok: false, error: message, request_id: requestId });
  }
}


