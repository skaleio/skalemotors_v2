# PWA + Push Notifications (v1) — Diseño

**Fecha:** 2026-06-17
**Estado:** Aprobado (brainstorming)
**Contexto:** Skale Motors v2 es web responsive (no PWA, no nativa). Vendedores la usan en el celular en la calle con 4G inestable. Objetivo: que "se sienta app" (instalable) y reciban push de eventos clave (lead asignado, lead vendido, etc.) — como Instagram/Google.

## Alcance v1

- Convertir la app en **PWA instalable** (ícono, splash, abre sin barra del navegador, shell cacheado para arranque rápido con mala señal).
- **Push notifications** que reflejan las notificaciones in-app existentes: cada fila nueva en `public.notifications` se envía como Web Push al/los device(s) del `recipient_user_id`.

**Fuera de v1 (fast-follow):** recordatorios por tiempo ("cita en 1h") que requieren pg_cron. Horario silencioso. Filtro por tipo de notificación.

## Principio central

**El push es espejo del campanita.** No se cambia cómo se crean las notificaciones (triggers existentes en `notifications`). Solo se cuelga un disparador nuevo: `notifications` INSERT → Edge Function → Web Push a las suscripciones del recipient. Si el push falla, la notificación in-app igual queda — nunca bloquea.

## Componentes

### Backend / DB
- **Tabla nueva `public.push_subscriptions`**: `id`, `user_id` (FK auth.users), `tenant_id`, `endpoint` (unique), `p256dh`, `auth`, `device_label`, `user_agent`, `created_at`, `last_seen_at`.
  - RLS: cada usuario hace SELECT/INSERT/UPDATE/DELETE solo sobre sus filas (`user_id = auth.uid()`). El `service_role` (Edge Function) lee todas.
  - Soporta **varios devices por usuario** (cel + escritorio): se envía a todos.
- **Trigger `AFTER INSERT` en `public.notifications`** (`trg_push_on_notification`): vía `pg_net` hace POST fire-and-forget a la Edge Function `push-send` con la fila nueva. Falla del POST no afecta el INSERT.
- **Edge Function `push-send`** (Deno): recibe la notificación, valida secreto compartido / service-role, busca suscripciones del `recipient_user_id`, firma VAPID (JWT ES256) + cifra payload (aes128gcm), POSTea a cada `endpoint`. Respuesta 404/410 → borra esa suscripción.

### Frontend
- **`vite-plugin-pwa`**: genera `manifest.webmanifest` (nombre, íconos 192/512, theme/background color, `display: standalone`) + Service Worker (Workbox) que cachea el shell.
- **Service Worker custom** (estrategia `injectManifest`): maneja evento `push` (`showNotification(title, {body: message, data: {url: action_url}, icon, badge})`) y `notificationclick` (focus tab existente o abre `action_url`).
- **`src/lib/services/pushSubscriptions.ts`**: suscribir (`pushManager.subscribe` con VAPID public key), guardar/actualizar fila, desuscribir/borrar.
- **`src/hooks/usePushNotifications.ts`**: estado de permiso (`default`/`granted`/`denied`), soporte del navegador, flujo de alta, `last_seen_at` refresh al abrir.
- **UI**: prompt suave post-login ("¿Activar avisos en este teléfono?") dismissible + toggle on/off en perfil. Detección iOS no-instalado → CTA "Agregá a inicio para recibir avisos".

## Flujo

1. Vendedor entra desde el cel → prompt → acepta permiso → SW se suscribe → fila en `push_subscriptions`.
2. Le asignan un lead → trigger existente inserta `notifications` → `trg_push_on_notification` dispara `push-send` → el cel muestra "Nuevo lead asignado" aunque la app esté cerrada.
3. Toca la notificación → abre la app en `action_url` (p. ej. `/app/leads?openLead=<id>`).

## Errores / bordes

- Permiso denegado → no se guarda nada; UI explica cómo reactivar.
- **iPhone**: Web Push solo si instaló la PWA (iOS 16.4+). Detectar y mostrar CTA de instalar. Android funciona directo.
- Suscripción muerta (404/410) → autolimpieza en `push-send`.
- Sin suscripciones para el recipient → no-op.
- Multi-tenant: el payload solo lleva `title` / `message` / `action_url` (ya user-facing); nada sensible extra. `push_subscriptions` con RLS por usuario; `notifications` ya es tenant-scoped.

## Seguridad

- VAPID **private key en Supabase Secrets** (`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); public key en env del front (`VITE_VAPID_PUBLIC_KEY`).
- Trigger → Edge Function autenticado por service-role / secreto compartido validado en la función. Nunca confiar en input del cliente para `recipient_user_id`.
- Antes de aplicar la migración correr `get_advisors`.

## Riesgo técnico

- **Único punto real**: librería Web Push compatible con Deno (VAPID + aes128gcm). Evaluar en implementación una lib de JSR (p. ej. `@negrel/webpush`) o implementar con Web Crypto. Validar con un device real antes de `gh pr ready`.

## Testing

- Unit: codificación de VAPID public key (base64url → Uint8Array), serialización de suscripción.
- Edge Function: test con suscripción fake / mock de fetch (incluye prune en 410).
- E2E (Playwright): registro del SW + manifest válido + flujo de suscripción (no se puede probar entrega real de push en headless). Entrega real se valida manualmente en un cel Android + un iPhone con PWA instalada.

## Convenciones del proyecto

- Migración: `supabase/migrations/YYYYMMDDHHMMSS_pwa_push_subscriptions.sql`. Regenerar tipos TS tras el schema.
- Supabase solo desde `src/lib/services/`. Fetch/cache en hooks. UI shadcn + Tailwind. Iconos lucide. Toasts sonner.
- Worktree dedicado + PR draft desde el primer commit. Validar `lint && build && test` antes de `gh pr ready`. Merge humano.
