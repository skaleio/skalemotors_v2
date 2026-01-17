import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type WebhookResult = {
  ok: boolean;
  inserted?: number;
  updated?: number;
  ignored?: number;
  error?: string;
};

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

function normalizePhone(phone: unknown): string | null {
  if (!phone) return null;
  const s = String(phone).trim();
  if (!s) return null;
  // Mantener + si viene, y números. Evitar formateos agresivos: YCloud/WhatsApp suelen usar E.164.
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
    // Si viene en segundos (WhatsApp/Meta a veces), convertir a ms.
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

// Parser tolerante: intenta mapear distintos formatos de webhook sin reventar.
function extractEvents(payload: unknown): unknown[] {
  // Soportar: { data: [...] } o { events: [...] } o payload directo.
  const p = asRecord(payload);
  const dataArr = asArray(p.data);
  if (dataArr.length) return dataArr.filter(Boolean);
  const eventsArr = asArray(p.events);
  if (eventsArr.length) return eventsArr.filter(Boolean);
  return (Array.isArray(payload) ? payload : [payload]).filter(Boolean);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Webhook token simple (recomendado). Configura YCLOUD_WEBHOOK_TOKEN y pásalo como header o query.
  const expectedToken = Deno.env.get("YCLOUD_WEBHOOK_TOKEN");
  if (expectedToken) {
    const tokenHeader =
      req.headers.get("x-webhook-token") ||
      req.headers.get("x-ycloud-token") ||
      req.headers.get("authorization");
    const tokenQuery = new URL(req.url).searchParams.get("token");
    const provided = tokenQuery || tokenHeader || "";
    if (!provided || !provided.includes(expectedToken)) {
      return jsonResponse(401, { ok: false, error: "Invalid webhook token" });
    }
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const events = extractEvents(payload);
  let inserted = 0;
  let updated = 0;
  let ignored = 0;

  // Intentar resolver inbox/branch desde provider_phone_number_id
  // (campo puede variar según proveedor; guardamos igual aunque no se encuentre, pero eso reduce visibilidad por RLS).
  for (const event of events) {
    try {
      const e = asRecord(event);
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

      // Campos típicos (variables). Se guardan en raw_payload sí o sí.
      const provider = "ycloud";
      const providerMessageId =
        e.message_id ?? e.id ?? messageObj.id ?? dataObj.message_id ?? null;
      const providerStatusId =
        e.status_id ?? firstStatus.id ?? deliveryObj.id ?? null;

      const from =
        normalizePhone(
          e.from ?? e.sender ?? messageObj.from ?? dataObj.from ?? contactObj.phone,
        );
      const to =
        normalizePhone(
          e.to ?? e.recipient ?? messageObj.to ?? dataObj.to ?? metadataObj.display_phone_number,
        );

      const text =
        e.text ||
        messageObj.text ||
        messageObj.body ||
        dataObj.text ||
        asRecord(dataObj.message).text ||
        e.content ||
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
        parseTimestampToIso(
          e.timestamp ?? e.sent_at ?? e.created_at ?? messageObj.timestamp ?? dataObj.timestamp ?? null,
        );

      const providerPhoneNumberId =
        e.phone_number_id ??
        metadataObj.phone_number_id ??
        dataObj.phone_number_id ??
        e.wa_phone_number_id ??
        null;

      // Resolver inbox
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

      // ¿Entrante o saliente?
      // Regla: si from coincide con nuestra línea, sería saliente; si no, entrante.
      // Como no siempre tenemos 'to', dejamos heurística simple:
      const directionRaw = String(e.direction ?? "").toLowerCase();
      const direction =
        directionRaw.includes("out") || directionRaw.includes("send") || directionRaw === "saliente"
          ? "saliente"
          : "entrante";

      // Para el "Centro de mensajes por teléfono" usamos el teléfono del contacto (cliente) como contact_phone.
      // Heurística: en entrantes, contact_phone = from. En salientes, contact_phone = to.
      const contactPhone = direction === "saliente" ? (to || from) : (from || to);

      if (!contactPhone) {
        ignored++;
        continue;
      }

      if (isStatus && providerMessageId) {
        // Actualizar status si ya existe
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

      // Insert de mensaje
      const { error: insertErr } = await supabase.from("messages").insert({
        type: "whatsapp",
        direction,
        subject: null,
        content: String(text || "").slice(0, 10000),
        status: "enviado",
        sent_at: timestamp ?? new Date().toISOString(),
        read_at: null,
        lead_id: null,
        user_id: null,
        branch_id: branchId,
        inbox_id: inboxId,
        contact_phone: contactPhone,
        contact_name: (contactObj.name as string | undefined) || (profileObj.name as string | undefined) || null,
        provider,
        provider_message_id: providerMessageId ? String(providerMessageId) : null,
        provider_status_id: providerStatusId ? String(providerStatusId) : null,
        raw_payload: event as unknown as AnyRecord,
      });

      // Si es duplicado por unique index, lo ignoramos.
      if (insertErr) {
        const msg = String(insertErr.message || "");
        if (msg.includes("duplicate") || msg.includes("unique")) {
          ignored++;
        } else {
          ignored++;
        }
      } else {
        inserted++;
      }
    } catch {
      ignored++;
    }
  }

  const result: WebhookResult = { ok: true, inserted, updated, ignored };
  return jsonResponse(200, result);
}


