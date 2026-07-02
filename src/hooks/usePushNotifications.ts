import { useAuth } from "@/contexts/AuthContext";
import { removePushSubscription, savePushSubscription } from "@/lib/services/pushSubscriptions";
import { useCallback, useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/**
 * "unsupported" — el navegador no soporta push (ej. iOS sin instalar la PWA).
 * "unconfigured" — falta VITE_VAPID_PUBLIC_KEY (deploy sin la env).
 * "denied" — el usuario bloqueó las notificaciones.
 * "subscribed" / "unsubscribed" — estado real de la suscripción en este device.
 */
export type PushState =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "subscribed"
  | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Veredicto sincrónico (sin tocar pushManager, que es async). */
function syncVerdict(supported: boolean, configured: boolean): PushState {
  if (!supported) return "unsupported";
  if (!configured) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  return "loading";
}

export function usePushNotifications() {
  const { user } = useAuth();
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const configured = !!VAPID_PUBLIC_KEY;

  const [state, setState] = useState<PushState>(() => syncVerdict(supported, configured));
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const verdict = syncVerdict(supported, configured);
    if (verdict !== "loading") {
      setState(verdict);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "unsubscribed");
    } catch {
      setState("unsubscribed");
    }
  }, [supported, configured]);

  // Solo el chequeo async (getSubscription); el setState ocurre dentro del .then,
  // no sincrónicamente en el cuerpo del efecto (evita cascading renders).
  useEffect(() => {
    if (syncVerdict(supported, configured) !== "loading") return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setState(sub ? "subscribed" : "unsubscribed");
      })
      .catch(() => {
        if (!cancelled) setState("unsubscribed");
      });
    return () => {
      cancelled = true;
    };
  }, [supported, configured]);

  const subscribe = useCallback(async () => {
    if (!supported || !configured || !user?.id) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
      await savePushSubscription({
        subscription: sub.toJSON(),
        userId: user.id,
        tenantId: user.tenant_id ?? null,
      });
      setState("subscribed");
    } finally {
      setBusy(false);
    }
  }, [supported, configured, user?.id, user?.tenant_id]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { state, busy, supported, configured, subscribe, unsubscribe, refresh };
}
