// Edge Function: push-send
//
// La invoca el trigger trg_push_on_notification (vía pg_net) con la fila de la
// notificación recién insertada. Envía un Web Push (RFC 8291) a cada device
// suscrito del recipient. Suscripción muerta (404/410) -> se borra sola.
//
// Auth: verify_jwt = false. Validamos a mano que el Bearer == service_role key
// (lo manda el dispatcher leyéndolo de Vault). Así funciona con cualquier
// formato de key del proyecto.
//
// Secrets requeridos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url, de
// `npx web-push generate-vapid-keys`), VAPID_SUBJECT (mailto:...).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@^0.3.0";
import { getCorsHeaders } from "../_shared/cors.ts";

type NotificationPayload = {
  notification_id?: string;
  recipient_user_id?: string;
  title?: string;
  message?: string;
  action_url?: string;
  type?: string;
};

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convierte las VAPID keys base64url (formato web-push) al formato JWK que
// espera @negrel/webpush.importVapidKeys.
function vapidKeysToJwk(publicB64url: string, privateB64url: string) {
  const pub = b64urlToBytes(publicB64url); // 65 bytes: 0x04 || X(32) || Y(32)
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  return {
    publicKey: { kty: "EC", crv: "P-256", x, y, key_ops: [], ext: true },
    privateKey: { kty: "EC", crv: "P-256", x, y, d: privateB64url, key_ops: ["sign"], ext: true },
  };
}

function getStatusFromError(err: unknown): number | null {
  const e = err as { response?: { status?: number }; status?: number } | null;
  return e?.response?.status ?? e?.status ?? null;
}

// Comparación en tiempo constante para evitar timing attacks contra el service key.
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// endpoint de push = URL única por device; no loggear completo.
function redactEndpoint(endpoint: string): string {
  return endpoint.slice(0, 40) + "…";
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // push-send es servidor-a-servidor (solo la invoca pg_net). Un request con
  // Origin viene de un browser → rechazar sin depender de la config de CORS.
  if (req.headers.get("origin")) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: "Missing Supabase env" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Auth: el Bearer debe ser el service_role key (lo manda el dispatcher).
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!timingSafeEqual(bearer, serviceKey)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return new Response(JSON.stringify({ ok: false, error: "Missing VAPID secrets" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: NotificationPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const recipientId = body.recipient_user_id?.trim();
  if (!recipientId) {
    return new Response(JSON.stringify({ ok: false, error: "recipient_user_id required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", recipientId);

  if (error) {
    console.error("[push-send] select subscriptions:", error);
    return new Response(JSON.stringify({ ok: false, error: "DB error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const subscriptions = (subs ?? []) as SubscriptionRow[];
  if (subscriptions.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, pruned: 0 }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const vapidKeys = await webpush.importVapidKeys(
    vapidKeysToJwk(vapidPublic, vapidPrivate),
    { extractable: false },
  );
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: vapidSubject,
    vapidKeys,
  });

  const messageText = JSON.stringify({
    title: body.title ?? "Skale Motors",
    message: body.message ?? "",
    action_url: body.action_url ?? "/app",
    type: body.type ?? null,
  });

  let sent = 0;
  let pruned = 0;
  const deadEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const subscriber = appServer.subscribe({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        });
        await subscriber.pushTextMessage(messageText, {});
        sent++;
      } catch (err) {
        const status = getStatusFromError(err);
        if (status === 404 || status === 410) {
          deadEndpoints.push(sub.endpoint);
        } else {
          console.error("[push-send] push failed:", redactEndpoint(sub.endpoint), status);
        }
      }
    }),
  );

  if (deadEndpoints.length > 0) {
    const { error: delErr } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", deadEndpoints);
    if (delErr) console.error("[push-send] prune dead subs:", delErr);
    else pruned = deadEndpoints.length;
  }

  return new Response(JSON.stringify({ ok: true, sent, pruned }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
