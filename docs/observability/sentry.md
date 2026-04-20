# Sentry — Observabilidad de errores

Guía operativa para desarrollo, despliegue e incident response con Sentry en SkaleMotors v2.

## 1. Componentes instalados

| Ámbito | Paquete | Archivo |
|---|---|---|
| Frontend (Vite + React) | `@sentry/react` | [src/lib/observability.ts](../../src/lib/observability.ts) |
| Integración con Supabase JS | `@supabase/sentry-js-integration` | idem |
| Edge Functions (Deno) | `npm:@sentry/deno` | [supabase/functions/_shared/sentryEdge.ts](../../supabase/functions/_shared/sentryEdge.ts) |
| Wrapper de captura en edge | propio | [supabase/functions/_shared/observability.ts](../../supabase/functions/_shared/observability.ts) |

Arranque del SDK en frontend: [src/main.tsx:99](../../src/main.tsx#L99) ejecuta `initObservability()` antes de renderizar la app. El `AppErrorBoundary` captura los errores de render y los envía con `captureAppError`.

Tags enganchados al usuario tras login: `role`, `tenant_id` (ver [AuthContext.tsx:159](../../src/contexts/AuthContext.tsx#L159)). Se limpian en `signOut`.

## 2. Variables de entorno

### Frontend (`.env` en raíz, prefijo `VITE_`)

```
VITE_SENTRY_DSN=https://xxxx@oXXXXX.ingest.sentry.io/XXXXX
VITE_APP_ENV=production          # development | preview | production
VITE_APP_RELEASE=<git-sha-corto> # opcional; ideal inyectarlo desde CI
```

Si `VITE_SENTRY_DSN` está vacío, el SDK no se inicializa (cero overhead en desarrollo).

### Edge Functions (Supabase Secrets)

```
supabase secrets set SENTRY_DSN=https://xxxx@oXXXXX.ingest.sentry.io/YYYYY
supabase secrets set SENTRY_ENVIRONMENT=production
supabase secrets set SENTRY_TRACES_SAMPLE_RATE=0.1
```

Usar un **DSN distinto** para edge (proyecto separado en Sentry) para poder filtrar frontend vs backend.

### Upload de source maps (CI) — _pendiente de configurar_

```
SENTRY_AUTH_TOKEN=sntrys_XXXXXXXXXX   # scope: project:releases, project:write
SENTRY_ORG=skalemotors
SENTRY_PROJECT=skalemotors-web
```

## 3. Source maps (TO-DO)

Sin upload de source maps, los stacktraces en producción llegan **minificados** (`a.js:1:4567`). Para trazarlos a archivo/línea real:

1. Instalar `@sentry/vite-plugin` como devDependency.
2. Añadir al `vite.config.ts`:
   ```ts
   import { sentryVitePlugin } from "@sentry/vite-plugin";
   // plugins: [..., sentryVitePlugin({
   //   org: process.env.SENTRY_ORG,
   //   project: process.env.SENTRY_PROJECT,
   //   authToken: process.env.SENTRY_AUTH_TOKEN,
   //   release: { name: process.env.VITE_APP_RELEASE },
   //   sourcemaps: { assets: "./dist/**" },
   // })]
   ```
3. En `build.sourcemap: true` para generarlos.
4. En CI: exponer `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` y `VITE_APP_RELEASE` (commit SHA).
5. Al deploy, Sentry marca el release. Para "resolved in next release" hay que llamar a `sentry-cli releases new/finalize` o dejar que el plugin lo haga.

## 4. Alertas recomendadas (configurar en Sentry UI)

- **New Issue** → notificar a Slack/email inmediato, severidad alta si `level:error` + `environment:production`.
- **Regression** → cuando un issue cerrado vuelve a dispararse.
- **Spike Detection** → > 10 eventos/min del mismo fingerprint.
- **Error Rate by Release** → alerta si un release nuevo supera en 2× la tasa del anterior.
- **Session crash-free rate** → bajo 99% en producción.

## 5. Runbook — qué hacer cuando llega una alerta

1. Abrir el issue en Sentry → copiar **fingerprint**, **release**, **environment**, tags `tenant_id` y `role`.
2. Revisar **breadcrumbs** (últimas acciones del usuario, peticiones a Supabase vía `supabaseIntegration`) y **Replay** si está disponible.
3. Identificar scope (elegir uno):
   - **Frontend**: archivo/línea (requiere source maps).
   - **Supabase REST/RPC**: breadcrumb con URL/método/status.
   - **Edge Function**: ir a logs de Supabase → `Edge Functions` → buscar por `execution_id` (tag) o `tenant_id`.
4. Reproducir: pedir el tenant/usuario en staging; ejecutar el path señalado por los breadcrumbs.
5. Fix mínimo + test/manual check.
6. Deploy con nuevo `VITE_APP_RELEASE`; en Sentry marcar el issue como "Resolved in next release".
7. Vigilar 30–60 min: si 0 eventos nuevos del mismo fingerprint en el release nuevo → cerrar el ticket.
8. Postmortem corto (5 líneas): causa · fix · prevención (test/monitor/flag).

## 6. Cobertura actual de edge functions

Usan `captureEdgeError` hoy:
- `supabase/functions/support-chat`
- `supabase/functions/ai-chat`

El resto de edge functions (lead ingestion, vendor-user-create, etc.) **no reportan a Sentry**. TO-DO: envolver sus handlers con `try { ... } catch (e) { await captureEdgeError(e, { tenant_id, user_id, role, module }); throw e; }` para no perder visibilidad.

## 7. Checklist post-instalación (verificar en cada deploy)

- [ ] `VITE_SENTRY_DSN` y `VITE_APP_ENV` presentes en el entorno de build.
- [ ] `VITE_APP_RELEASE` inyectado en CI (commit SHA corto).
- [ ] Source maps subidos (`sentry-cli releases files <release> list` muestra los `.map`).
- [ ] Secretos de edge (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`) configurados con `supabase secrets list`.
- [ ] Un error sintético (`throw new Error("sentry-smoke")` en dev preview) aparece en Sentry con `user.id`, `tenant_id`, `role`.
- [ ] Tras logout, el siguiente error del mismo navegador ya no trae `user.id` del anterior.
- [ ] Reglas de alerta activas (new issue, regression, spike) con destino definido.

## 8. Qué NO capturamos (lista de ignorados)

Config actual en [observability.ts](../../src/lib/observability.ts):

- `ResizeObserver loop limit exceeded` y variante (ruido de navegador benigno).
- `AbortError: The user aborted a request` (el usuario navegó antes del fetch).
- `Non-Error promise rejection captured` (ruido de libs externas).
- URLs de extensiones de navegador (`chrome-extension://`, `moz-extension://`, `safari-extension://`).

No silenciar errores "Failed to fetch dynamically imported module": pueden indicar chunks 404 tras deploy reales y el comportamiento actual es fallback a pantalla de error (ver [src/main.tsx](../../src/main.tsx)).
