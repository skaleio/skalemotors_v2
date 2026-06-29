/// <reference lib="WebWorker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

// Precache del shell generado por vite-plugin-pwa (injectManifest) → la app
// abre al instante aunque la señal esté mala.
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

type PushPayload = {
  title?: string;
  message?: string;
  action_url?: string;
  type?: string;
};

// Push: inerte hasta que el backend (PR2) empiece a enviar. Cuando llegue un
// push, muestra la notificación aunque la app esté cerrada.
self.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = { message: event.data?.text() };
  }

  const title = payload.title || "Skale Motors";
  const body = payload.message || "";
  const url = payload.action_url || "/app";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      tag: payload.type || undefined,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data as { url?: string } | undefined)?.url || "/app";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        await client.focus();
        try {
          await client.navigate(url);
        } catch {
          // algunos navegadores no permiten navigate cross-context; ya enfocamos
        }
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
