import { supabase } from "@/lib/supabase";

/**
 * Persistencia de suscripciones Web Push. Una fila por device (endpoint único).
 * RLS: el usuario solo maneja sus propias filas. La Edge Function push-send
 * (service_role) las lee para enviar y poda las muertas.
 */

type SavePushSubscriptionInput = {
  subscription: PushSubscriptionJSON;
  userId: string;
  tenantId: string | null;
};

export async function savePushSubscription({
  subscription,
  userId,
  tenantId,
}: SavePushSubscriptionInput): Promise<void> {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Suscripción push incompleta (faltan endpoint/keys).");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      tenant_id: tenantId,
      endpoint,
      p256dh,
      auth,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw error;
}
