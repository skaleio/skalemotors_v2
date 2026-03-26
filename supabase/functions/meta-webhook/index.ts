import { corsHeaders } from "../_shared/cors.ts";

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
  return cleaned.length >= 8 ? cleaned : s.replace(/[^\d]/g, "");
}

type AnyRecord = Record<string, unknown>;

function asRecord(v: unknown): AnyRecord {
  return typeof v === "object" && v !== null ? (v as AnyRecord) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function parseTimestampToIso(v: unknown): string | null {
  if (v === null || v === undefined) return null;

  if (typeof v === "number") {
    const ms = v < 1_000_000_000_000 ? v * 1000 : v;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isNaN(n)) {
    const ms = n < 1_000_000_000_000 ? n * 1000 : n;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
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
  // Compare only hex digits as strings
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null) {
  if (!header) return false;
  const provided = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;
  const computed = await hmacSha256Hex(appSecret, rawBody);
  return timingSafeEqualHex(provided, computed);
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

async function resolveInbox(
  supabase: any,
  providerPhoneNumberId: string | null,
  displayNumber: string | null,
) {
  if (providerPhoneNumberId) {
    const { data: inbox } = await supabase
      .from("whatsapp_inboxes")
      .select("id, branch_id")
      .eq("provider", "meta")
      .eq("provider_phone_number_id", String(providerPhoneNumberId))
      .eq("is_active", true)
      .maybeSingle();
    return { inboxId: inbox?.id ?? null, branchId: inbox?.branch_id ?? null };
  }

  if (displayNumber) {
    const { data: inbox } = await supabase
      .from("whatsapp_inboxes")
      .select("id, branch_id")
      .eq("provider", "meta")
      .eq("display_number", String(displayNumber))
      .eq("is_active", true)
      .maybeSingle();
    return { inboxId: inbox?.id ?? null, branchId: inbox?.branch_id ?? null };
  }

  return { inboxId: null as string | null, branchId: null as string | null };
}

async function resolveLeadId(
  supabase: any,
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

async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // GET: verificación del webhook por parte de Meta
    if (req.method === "GET") {
      const expectedToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode") || "";
      const token = url.searchParams.get("hub.verify_token") || "";
      const challenge = url.searchParams.get("hub.challenge") || "";

      if (mode === "subscribe" && expectedToken && token === expectedToken) {
        return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
      }
      return jsonResponse(403, {
        ok: false,
        error: "Invalid webhook verification parameters",
        request_id: requestId,
      });
    }

    if (req.method !== "POST") {
      return jsonResponse(405, { ok: false, error: "Method not allowed", request_id: requestId });
    }

    const appSecret = getEnvAny(["META_APP_SECRET"]) ?? "";
    if (!appSecret) {
      return jsonResponse(500, { ok: false, error: "Missing META_APP_SECRET", request_id: requestId });
    }

    // Para la verificación, se debe usar el raw body (sin parsear).
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const okSig = await verifyMetaSignature(appSecret, rawBody, signatureHeader);
    if (!okSig) {
      return jsonResponse(401, { ok: false, error: "Invalid X-Hub-Signature-256", request_id: requestId });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
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

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const n8nWebhookUrl = Deno.env.get("N8N_MESSAGE_WEBHOOK_URL");
    const n8nWebhookToken = Deno.env.get("N8N_MESSAGE_WEBHOOK_TOKEN");

    const entries = asArray(asRecord(payload).entry);

    let inserted = 0;
    let updated = 0;
    let ignored = 0;
    const provider = "meta";

    for (const entry of entries) {
      const e = asRecord(entry);
      const changes = asArray(e.changes);
      for (const ch of changes) {
        const change = asRecord(ch);
        const value = asRecord(change.value);

        const metadata = asRecord(value.metadata);
        const providerPhoneNumberId = metadata.phone_number_id ? String(metadata.phone_number_id) : null;
        const displayNumber = metadata.display_phone_number ? String(metadata.display_phone_number) : null;

        const { inboxId, branchId } = await resolveInbox(
          supabase,
          providerPhoneNumberId,
          displayNumber,
        );

        const contacts = asArray(value.contacts);
        const contact0 = contacts[0] ? asRecord(contacts[0]) : {};
        const profile0 = asRecord(contact0.profile);
        const contactName = (profile0.name as string | undefined) ?? null;

        // Incoming messages: value.messages[]
        const messagesArr = asArray(value.messages);
        for (const m of messagesArr) {
          const msg = asRecord(m);
          const providerMessageId = (msg.id as string | undefined) ?? null;
          const from = normalizePhone(msg.from);
          const sentAt = parseTimestampToIso(msg.timestamp) ?? new Date().toISOString();

          // Solo soportamos texto por ahora; otros tipos se guardan con contenido vacío.
          const text =
            asRecord(msg.text).body
              ? String(asRecord(msg.text).body)
              : msg?.text && typeof msg.text === "object"
                ? String((msg.text as AnyRecord).body ?? "")
                : "";

          const leadId = await resolveLeadId(supabase, from, branchId);

          const { error: insertErr } = await supabase.from("messages").insert({
            type: "whatsapp",
            direction: "entrante",
            subject: null,
            content: String(text || "").slice(0, 10000),
            status: "enviado",
            sent_at: sentAt,
            read_at: null,
            lead_id: leadId,
            user_id: null,
            branch_id: branchId,
            inbox_id: inboxId,
            contact_phone: from,
            contact_name: contactName,
            provider,
            provider_message_id: providerMessageId ? String(providerMessageId) : null,
            provider_status_id: null,
            raw_payload: msg,
          });

          if (insertErr) {
            const msgTxt = String(insertErr.message || "");
            if (msgTxt.toLowerCase().includes("duplicate") || msgTxt.toLowerCase().includes("unique")) {
              ignored++;
              continue;
            }
            ignored++;
            continue;
          }

          inserted++;
          if (n8nWebhookUrl) {
            await postToN8n(n8nWebhookUrl, n8nWebhookToken, {
              event: "message.received",
              provider,
              provider_message_id: providerMessageId,
              direction: "entrante",
              contact_phone: from,
              contact_name: contactName,
              content: String(text || ""),
              sent_at: sentAt,
              inbox_id: inboxId,
              branch_id: branchId,
              lead_id: leadId,
              raw: msg,
            });
          }
        }

        // Outgoing statuses: value.statuses[]
        const statusesArr = asArray(value.statuses);
        for (const s of statusesArr) {
          const st = asRecord(s);
          const providerMessageId = (st.id as string | undefined) ?? null;
          const statusRaw = String(st.status ?? "").toLowerCase();

          const mappedStatus =
            statusRaw.includes("read") ? "leido"
              : statusRaw.includes("delivered") ? "entregado"
                : statusRaw.includes("sent") ? "enviado"
                  : statusRaw.includes("failed") || statusRaw.includes("error") ? "fallido"
                    : statusRaw ? "enviado" : null;

          if (!providerMessageId || !mappedStatus) {
            ignored++;
            continue;
          }

          const providerStatusId = String(st.id ?? providerMessageId);
          const statusAt = parseTimestampToIso(st.timestamp) ?? undefined;

          const { error } = await supabase
            .from("messages")
            .update({
              status: mappedStatus,
              provider_status_id: providerStatusId,
              raw_payload: value,
              ...(statusAt && mappedStatus === "leido" ? { read_at: statusAt } : {}),
            })
            .eq("type", "whatsapp")
            .eq("provider", provider)
            .eq("provider_message_id", String(providerMessageId));

          if (!error) updated++;
          else ignored++;
        }
      }
    }

    return jsonResponse(200, { ok: true, inserted, updated, ignored, request_id: requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unhandled error";
    return jsonResponse(500, { ok: false, error: message, request_id: requestId });
  }
}

Deno.serve((req) => handler(req));

