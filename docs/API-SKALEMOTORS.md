# API Skale Motors — Referencia

Documentación de los **endpoints HTTP propios** de Skale Motors v2: rutas servidas por Vercel, Edge Functions de Supabase y el proxy de la app vitrina.

> Esta guía describe **nuestra API**, no contratos de terceros (Meta, GetAPI, ChileAutos, OpenAI, etc.).

---

## Hosts y rutas base

| Superficie | Base URL | Cuándo usarla |
|------------|----------|---------------|
| **Vercel (producto)** | `https://skalemotors-v2.vercel.app` | n8n, landings, integraciones externas contra el dominio del producto |
| **Supabase Edge** | `https://<PROJECT_REF>.supabase.co/functions/v1/<nombre>` | App CRM, vitrina SSR, webhooks, caminos legacy |
| **Vitrina Next.js** | `https://<dominio-vitrina>/api/lead` | Formularios públicos de la vitrina (proxy interno) |

**Preview / local:** sustituye el host de Vercel por la URL del deployment o `http://localhost:5173` según corresponda.

---

## Convenciones globales

| Tema | Detalle |
|------|---------|
| **Formato** | JSON en cuerpos y respuestas, salvo indicación contraria |
| **Errores** | `{ ok: false, error: string }` o `{ error: string }` con HTTP 4xx/5xx |
| **CORS (ingesta)** | `POST` + `OPTIONS`; cabeceras permitidas: `Content-Type`, `x-api-key`, `Authorization`, `Idempotency-Key` |
| **Idempotencia** | Cabecera `Idempotency-Key` en ingesta de leads/citas; respuestas cacheadas en `lead_ingest_idempotency` |
| **Teléfono Chile** | Se normaliza a `+56 9XXXXXXXX` |
| **Fechas citas** | `date` (`YYYY-MM-DD`) + `time` (`HH:mm`) en zona `America/Santiago`, o `scheduled_at` ISO UTC |
| **Honeypot anti-spam** | Campos `company` / `website` rellenos → HTTP 200 `{ ok: true }` sin persistir datos |

---

## Autenticación

### 1. Clave de ingesta por sucursal (recomendada en producción)

- Generada en la app: **Ajustes → API ingesta** (`mint_lead_ingest_key`).
- Se guarda solo el hash en `lead_ingest_keys`; el secreto en claro se muestra **una vez** al crear.
- Envío: `x-api-key: <secreto>` **o** `Authorization: Bearer <secreto>`.
- La clave está ligada a un `branch_id`; si envías `branch_id` en el body, debe coincidir.

### 2. Clave global de desarrollo (solo no-producción)

- Variable Vercel: `N8N_LEAD_INGEST_API_KEY`.
- **Bloqueada en producción.** Requiere siempre `branch_id` en el JSON.

### 3. JWT de Supabase (app CRM)

- Cabecera: `Authorization: Bearer <access_token>`.
- También: `apikey: <SUPABASE_ANON_KEY>`.
- Usado por casi todas las Edge Functions internas.

### 4. Secrets de automatización (Edge)

| Secret | Endpoint |
|--------|----------|
| `LEAD_INGEST_API_KEY` | `lead-create`, `landing-booking` (legacy) |
| `LEAD_STATE_API_KEY` | `lead-state-update` (solo no-prod; prod usa clave mintada) |
| `PENDING_TASK_API_KEY` | `pending-task-create` |

### 5. Webhooks firmados

- `meta-webhook`: firma `X-Hub-Signature-256`.
- `ycloud-webhook`: firma `YCloud-Signature`.

### RPCs de gestión de claves (desde usuario autenticado en CRM)

| RPC | Uso |
|-----|-----|
| `mint_lead_ingest_key(p_branch_id, p_label?)` | Crea clave; devuelve secreto en claro una sola vez |
| `list_lead_ingest_keys(p_branch_id)` | Metadatos de claves activas |
| `revoke_lead_ingest_key(p_key_id)` | Revoca clave |

---

# Parte I — API Vercel (integraciones externas)

Base: `https://skalemotors-v2.vercel.app`

Estos son los endpoints **recomendados** para n8n, landings y partners.

---

## 1. Ingesta de leads

### `POST /api/n8n-lead-ingest`

Crea o actualiza un lead en CRM. Si el body incluye `date` + `time` (o `scheduled_at`), **desvía automáticamente** a ingesta de cita (`processAppointmentIngest`).

#### Autenticación

`x-api-key` o `Authorization: Bearer` (clave mintada o global dev).

Cabecera opcional: `Idempotency-Key`.

#### Cuerpo — campos principales

| Campo | Tipo | Notas |
|-------|------|--------|
| `branch_id` | string (UUID) | Obligatorio con clave global dev; opcional con clave mintada |
| `phone` / `telefono` | string | **Requerido** (formato Chile) |
| `full_name` / `nombre` | string | Default: `"Sin nombre"` |
| `email`, `rut`, `region` | string \| null | Opcionales |
| `source` | string | `web`, `referido`, `walk_in`, `telefono`, `redes_sociales`, `evento`, `otro`, `whatsapp`. Default: `whatsapp` |
| `status` | string | `nuevo`, `contactado`, `interesado`, `cotizando`, `negociando`, `en_espera`, `vendido`, `perdido`, `para_cierre`, `cancelado`. Default al crear: `nuevo` |
| `priority` | string | `baja`, `media`, `alta`. Default: `alta` |
| `payment_type` / `payment_method` | string | Opcional |
| `budget` / `presupuesto` | string \| number | Opcional |
| `vehicle_interest` / `tipo_vehiculo` | string | También columna dedicada |
| `notes`, `chat_summary`, `raw_message` / `mensaje_mike` | string | Se combinan en `notes` / `raw_message` |
| `tags` | array | Debe ser array si se envía |
| `state`, `state_confidence`, `state_reason` | string / number | Estado enriquecido (IA) |
| `update_existing` | boolean | Default `true`: actualiza por teléfono + sucursal |
| `assigned_to` | UUID | Vendedor asignado (`public.users`) |
| `assigned_to_email`, `calendar_email` | string | Resolución alternativa de asignado |

**Campos IA / WhatsApp (opcionales):** `uso_principal`, `pasajeros_filas`, `transmision`, `pie_disponible`, `marca_preferida`, `anos_minimo`, `preferencia`, `alerta_crediticia`, y aliases en español.

**Campos de cita (si vienen, activan flujo calendario):** `date`, `time`, `scheduled_at`, `title`, `type`, `description`, `create_lead`, `lead_id`, `vehicle_id`.

#### Respuesta `200`

```json
{
  "ok": true,
  "created": true,
  "data": {
    "id": "uuid",
    "full_name": "Juan Pérez",
    "phone": "+56 912345678",
    "status": "nuevo",
    "state": null,
    "branch_id": "uuid",
    "tenant_id": "uuid",
    "created_at": "…",
    "updated_at": "…"
  },
  "appointment": null
}
```

- `created: false` → lead actualizado.
- `appointment` → presente si se creó cita colateral (p. ej. landing Miami con `date`+`time`).

#### Errores frecuentes

| HTTP | Causa |
|------|-------|
| `401` | Falta clave o clave inválida |
| `403` | `branch_id` no coincide con la clave |
| `400` | JSON inválido, teléfono inválido, sucursal inexistente, `tags` no es array |
| `405` | Método distinto de `POST` |
| `500` | Variables Supabase faltantes en Vercel |

#### Ejemplo

```bash
curl -sS -X POST "https://skalemotors-v2.vercel.app/api/n8n-lead-ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_CLAVE_MINTADA" \
  -H "Idempotency-Key: lead-juan-20260605" \
  -d '{
    "phone": "912345678",
    "full_name": "Juan Pérez",
    "source": "whatsapp",
    "assigned_to_email": "vendedor@concesionaria.cl"
  }'
```

---

## 2. Ingesta de citas (calendario)

### `POST /api/appointment-ingest`

Crea una cita en **Citas**. Por defecto **no crea leads** en CRM.

Flujo típico: landing → webhook n8n → agente estructura JSON → este endpoint.

#### Autenticación

Igual que ingesta de leads + `Idempotency-Key` opcional (prefijo interno `appt:`).

#### Cuerpo

| Campo | Tipo | Notas |
|-------|------|--------|
| `date` + `time` | string | **Requerido** si no hay `scheduled_at`. Hora Chile |
| `scheduled_at` | string | ISO UTC alternativo |
| `full_name` / `fullName` | string | Default `"Sin nombre"` |
| `phone`, `email` | string | Van a notas de la cita |
| `title` | string | Default: `Visita agendada · {nombre}` |
| `type` | string | `test_drive`, `reunion`, `entrega`, `servicio`, `otro` (+ alias EN: `meeting`, `delivery`, …) |
| `status` | string | `programada`, `completada`, `cancelada`. Default: `programada` |
| `duration_minutes` | number | Default: `60` |
| `end_at` | string | ISO; si falta, se calcula |
| `assigned_to` | UUID | Dueño del calendario |
| `assigned_to_email` / `calendar_email` / `calendar_user_email` | string | Alternativa recomendada al UUID |
| `lead_id` | UUID | Vincula cita a lead existente |
| `create_lead` | boolean | Default `false`. Solo `true` crea/actualiza lead |
| `vehicle_id` | UUID | Opcional |
| `notes`, `description` | string | Interés del cliente |
| `source` | string | Etiqueta de origen (ej. `landing-meta`) |
| `branch_id` | UUID | Solo relevante con clave global dev |

#### Respuesta `200`

```json
{
  "ok": true,
  "lead": null,
  "appointment": {
    "id": "uuid",
    "scheduled_at": "2026-06-04T14:00:00.000Z",
    "user_id": "uuid-vendedor",
    "title": "Visita agendada · Juan Pérez"
  },
  "calendar_user_resolved_via": "assigned_to_email"
}
```

Si `create_lead: true`:

```json
{
  "ok": true,
  "lead": { "id": "uuid", "created": true },
  "appointment": { "…": "…" }
}
```

#### Ejemplo

```bash
curl -sS -X POST "https://skalemotors-v2.vercel.app/api/appointment-ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_CLAVE_MINTADA" \
  -H "Idempotency-Key: booking-juan-20260604" \
  -d '{
    "full_name": "Juan Pérez",
    "phone": "+56 912345678",
    "date": "2026-06-04",
    "time": "10:00",
    "type": "reunion",
    "source": "landing-meta",
    "assigned_to_email": "miami@motors.cl"
  }'
```

Script de prueba: `node scripts/test-appointment-ingest.mjs`.

---

## 3. Agendamiento landing (Miami Motors)

### `POST /api/landing-booking`

Atajo dedicado: **solo cita**, sin lead en CRM. Sucursal y calendario fijos en código (`LANDING_BRANCH_ID`, `LANDING_USER_ID`).

#### Autenticación

Igual que ingesta (clave mintada).

#### Cuerpo

| Campo | Requerido | Notas |
|-------|-----------|--------|
| `full_name` / `fullName` | Recomendado | |
| `phone` | **Sí** | Formato Chile |
| `email`, `notes` | No | |
| `date` + `time` | **Sí** (o `scheduled_at`) | Chile |
| `source` | No | Default: `meta-ads` |

#### Respuesta `200`

```json
{
  "ok": true,
  "appointment": {
    "id": "uuid",
    "scheduled_at": "…",
    "user_id": "uuid"
  }
}
```

---

## 4. Proxy Edge (same-origin Vercel)

### `POST /api/edge/{fn}`

Reenvía peticiones autenticadas al host Supabase. Evita CORS cuando el frontend en Vercel llama funciones que exigen JWT.

#### Funciones permitidas

- `zernio-*` (todas las de redes sociales Zernio)
- `vendor-user-create`
- `vendor-user-delete`

#### Autenticación

`Authorization: Bearer <JWT Supabase>` (sesión del usuario CRM).

#### Ejemplo

```bash
POST https://skalemotors-v2.vercel.app/api/edge/vendor-user-create
Authorization: Bearer eyJ…
Content-Type: application/json

{ "email": "…", "full_name": "…", "branch_id": "…" }
```

---

# Parte II — Edge Functions Supabase

Base: `https://<PROJECT_REF>.supabase.co/functions/v1/<nombre>`

---

## A. Ingesta y automatización (API key)

Endpoints para n8n y scripts. **En integraciones nuevas, preferir los equivalentes Vercel** (Parte I).

### `POST /functions/v1/lead-create` ⚠️ Legacy

Alternativa histórica a `/api/n8n-lead-ingest`. Contrato **más restrictivo** (menos campos, enums distintos).

| Campo | Notas |
|-------|--------|
| `branch_id` | **Requerido** |
| `phone` | **Requerido** |
| `full_name`, `email`, `rut`, `region`, `notes`, `budget`, `tags` | Opcionales |
| `source` | Sin `whatsapp` en lista original |
| `status` | Subconjunto pipeline |
| `update_existing` | boolean |
| `assigned_to` | UUID vendedor |

Auth: `x-api-key` / Bearer / `?api_key=` → `LEAD_INGEST_API_KEY` o clave mintada.

---

### `POST /functions/v1/lead-state-update`

Actualiza el estado enriquecido de un lead (IA / n8n).

| Campo | Requerido |
|-------|-----------|
| `lead_id` | Sí (UUID) |
| `branch_id` | Sí (UUID) |
| `state` | Sí |
| `state_confidence`, `state_reason`, `state_updated_at` | No |

Si `state` coincide con un `status` válido del pipeline, también sincroniza `status`.

Auth: clave mintada (`verify_lead_ingest_key`) en prod; `LEAD_STATE_API_KEY` solo en no-prod.

Respuesta `200`:

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "state": "interesado_compra",
    "state_confidence": 0.92,
    "state_reason": "…",
    "state_updated_at": "…",
    "status": "interesado"
  }
}
```

---

### `POST /functions/v1/landing-booking`

Equivalente Supabase de `/api/landing-booking`. Misma lógica: cita sin lead CRM.

Auth: `LEAD_INGEST_API_KEY` / `BOOKING_INGEST_API_KEY` o clave mintada.

---

### `POST /functions/v1/pending-task-create`

Crea tarea pendiente para un vendedor/sucursal.

| Campo | Requerido | Valores |
|-------|-----------|---------|
| `branch_id` | Sí | UUID |
| `title` | Sí | string |
| `assigned_to` | No | UUID |
| `priority` | No | `urgent`, `today`, `later` (default `today`) |
| `action_type` | No | `contactar`, `llamar`, `confirmar`, `enviar_cotizacion`, `otro` |
| `entity_type` | No | `lead`, `appointment`, `custom` |
| `entity_id` | No | UUID |
| `description`, `action_label`, `metadata`, `due_at`, `source` | No | |

Auth: clave mintada o `PENDING_TASK_API_KEY`.

---

## B. Vitrina pública (sin JWT)

El `tenant_id` **nunca** viene del cliente; se resuelve por hostname verificado (`tenant_domains`).

### `GET /functions/v1/public-vitrina`

Lectura pública de sitio, sucursales y vehículos publicados.

| Query | Descripción |
|-------|-------------|
| `host` | Dominio del sitio (**requerido** si no viene en headers) |
| `path` | `home` (default), `site`, `vehicles`, `vehicle` |
| `id` | UUID vehículo (solo `path=vehicle`) |

Respuestas:

| `path` | Contenido |
|--------|-----------|
| `site` | `{ site, branches }` |
| `vehicles` | `{ vehicles: [...] }` |
| `vehicle` | `{ vehicle }` |
| `home` | `{ site, branches, vehicles }` |

Cache: `public, s-maxage=60, stale-while-revalidate=300`.

---

### `POST /functions/v1/vitrina-lead`

Formulario de contacto / consulta por vehículo → crea lead en CRM.

| Campo | Requerido |
|-------|-----------|
| `host` | Sí (o header `Host` / `X-Forwarded-Host`) |
| `full_name` | Sí |
| `phone` | Sí (mín. 8 dígitos) |
| `email`, `message`, `vehicle_id` | No |

Anti-spam: honeypot `company`/`website`, dedup 2 min por teléfono+tenant.

Respuesta: `{ ok: true }` o `{ ok: true, deduped: true }`.

---

### `POST /api/lead` (app vitrina Next.js)

Proxy same-origin que reenvía a `vitrina-lead` con el `host` de la petición.

```bash
POST https://autos.ejemplo.cl/api/lead
Content-Type: application/json

{
  "full_name": "María López",
  "phone": "+56987654321",
  "message": "Consulta por el SUV",
  "vehicle_id": "uuid-opcional"
}
```

---

## C. Webhooks entrantes

| Función | Método | Descripción |
|---------|--------|-------------|
| `meta-webhook` | GET/POST | Verificación y eventos Meta (WhatsApp / Ads) |
| `ycloud-webhook` | POST | Eventos YCloud WhatsApp |

Configuración de URLs en Meta/YCloud: `https://<PROJECT_REF>.supabase.co/functions/v1/<nombre>`.

---

## D. API interna CRM (JWT requerido)

Invocadas desde la app React con sesión Supabase. Todas aceptan `POST` salvo donde se indique.

### Usuarios y acceso vendor

| Función | Propósito |
|---------|-----------|
| `vendor-user-create` | Crear usuario vendedor |
| `vendor-user-delete` | Eliminar/desactivar vendedor |

> También accesibles vía `POST /api/edge/{fn}` desde Vercel.

### WhatsApp

| Función | Propósito |
|---------|-----------|
| `whatsapp-connect` | Iniciar conexión Meta WhatsApp |
| `whatsapp-disconnect` | Desconectar |
| `whatsapp-status` | Estado de conexión |
| `whatsapp-send` | Enviar mensaje |

### YCloud (WhatsApp alternativo)

| Función | Propósito |
|---------|-----------|
| `ycloud-connect` | Conectar cuenta YCloud |
| `ycloud-disconnect` | Desconectar |
| `ycloud-status` | Estado |

### Meta Ads

| Función | Propósito |
|---------|-----------|
| `meta-ads-connect` | OAuth / vincular cuenta |
| `meta-ads-disconnect` | Desvincular |
| `meta-ads-status` | Estado conexión |
| `meta-ads-campaigns` | Listar campañas |
| `meta-ads-insights` | Métricas / insights |

### Marketplaces

| Función | Propósito |
|---------|-----------|
| `marketplace-connect` | Vincular marketplace |
| `marketplace-sync` | Sincronizar inventario |
| `marketplace-publish` | Publicar vehículo |

### Vehículos y tasación

| Función | Propósito |
|---------|-----------|
| `vehicle-lookup` | Consulta datos vehículo |
| `vehicle-valuation` | Valoración |
| `getapi-appraisal` | Tasación vía GetAPI |

### IA

| Función | Propósito |
|---------|-----------|
| `ai-chat` | Chat asistente interno |
| `ai-generate` | Generación Anthropic |
| `ai-brain-refresh` | Refrescar contexto IA por sucursal |
| `studio-ia-generate` | Generadores Studio IA (+ webhook n8n) |
| `support-chat` | Chat de soporte |

### Redes sociales (Zernio)

| Función | Propósito |
|---------|-----------|
| `zernio-connect-url` | URL OAuth Zernio |
| `zernio-accounts-list` | Cuentas conectadas |
| `zernio-accounts-sync` | Sincronizar cuentas |
| `zernio-accounts-disconnect` | Desconectar cuenta |
| `zernio-posts-list` | Listar publicaciones |
| `zernio-posts-create` | Crear publicación |
| `zernio-media-presign` | URL firmada para media |

### Vitrina (admin)

| Función | Propósito |
|---------|-----------|
| `vitrina-domain` | Gestionar dominios (JWT gerente/admin) |

---

# Parte III — Variables de entorno (Vercel)

| Variable | Endpoints afectados |
|----------|---------------------|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Todos los de ingesta |
| `SUPABASE_SERVICE_ROLE_KEY` | Todos los de ingesta |
| `N8N_LEAD_INGEST_API_KEY` | Ingesta leads/citas (solo dev) |
| `LEAD_INGEST_ALLOWED_ORIGINS` | CORS ingesta (comma-separated) |
| `VITE_SUPABASE_ANON_KEY` | Proxy `/api/edge/*` |

---

# Parte IV — Guía de integración rápida

## n8n → leads

```
POST https://skalemotors-v2.vercel.app/api/n8n-lead-ingest
x-api-key: <clave mintada>
Body: { "phone": "…", "full_name": "…", "source": "whatsapp" }
```

## n8n → citas (sin lead)

```
POST https://skalemotors-v2.vercel.app/api/appointment-ingest
x-api-key: <clave mintada>
Idempotency-Key: <id único>
Body: { "full_name", "phone", "date", "time", "assigned_to_email", "source" }
```

## Vitrina → lead

```
POST https://<dominio-vitrina>/api/lead
Body: { "full_name", "phone", "message?", "vehicle_id?" }
```

## Actualizar estado IA de lead

```
POST https://<PROJECT_REF>.supabase.co/functions/v1/lead-state-update
x-api-key: <clave mintada>
Body: { "lead_id", "branch_id", "state", "state_confidence?" }
```

---

# Checklist pre-producción

- [ ] Claves mintadas por sucursal (`mint_lead_ingest_key`); no depender de `N8N_LEAD_INGEST_API_KEY` en prod
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en Vercel
- [ ] `CHILEAUTOS_SCRAPE_API_KEY` si usas scrape en prod
- [ ] `LEAD_INGEST_ALLOWED_ORIGINS` restringido si la ingesta se llama desde browser
- [ ] n8n apunta a `skalemotors-v2.vercel.app`, no a `*.supabase.co` (salvo legacy)
- [ ] Citas: `assigned_to_email` del vendedor dueño del calendario
- [ ] Idempotency-Key en flujos con reintentos

---

*Última revisión alineada al código en `api/` y `supabase/functions/`. Para cambios de contrato, verificar implementación antes de integrar.*
