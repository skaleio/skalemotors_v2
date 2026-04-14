# API HTTP en Vercel — SKALEMOTORS

Documentación de los endpoints servidos por la **aplicación desplegada en Vercel**. Todo lo que sigue usa este origen:

**Base URL:** `https://skalemotors-v2.vercel.app`

---

## Importante: no confundir con Supabase Edge Functions

| Dónde integras | Host | Ejemplo de ruta |
|----------------|------|-----------------|
| **Esta documentación (Vercel)** | `skalemotors-v2.vercel.app` | `POST …/api/n8n-lead-ingest` |
| **Otro camino (no es Vercel)** | `<TU_PROJECT_REF>.supabase.co` | `POST …/functions/v1/lead-create` |

- **`/api/n8n-lead-ingest`** vive en **Vercel**. Autenticación: variable de entorno **`N8N_LEAD_INGEST_API_KEY`** (clave global) o **claves emitidas en la app** (`mint_lead_ingest_key` → tabla `lead_ingest_keys`).
- **`lead-create`** es una **Edge Function de Supabase**: URL `https://<TU_PROJECT_REF>.supabase.co/functions/v1/lead-create`, secreto **`LEAD_INGEST_API_KEY`**. El contrato (enums, `update_existing`, etc.) **no es idéntico** al de Vercel.

Si en **n8n** quieres integrar contra el dominio del producto en Vercel, la URL base correcta es **`https://skalemotors-v2.vercel.app`**, no `*.supabase.co`.

---

## Convenciones

| Tema | Detalle |
|------|---------|
| **JSON** | Cuerpos y respuestas JSON salvo donde se indique otro `Content-Type`. |
| **Errores** | Suele devolverse `{ ok: false, error: string }` con 4xx/5xx. |
| **CORS (ingesta)** | `POST` y `OPTIONS`; cabeceras permitidas incluyen `Content-Type`, `x-api-key`, `Authorization`. |

---

## 1. Ingesta de leads (N8N e integraciones externas)

### 1.1 Endpoint

| | |
|---|---|
| **URL** | `https://skalemotors-v2.vercel.app/api/n8n-lead-ingest` |
| **Método** | `POST` |
| **Content-Type** | `application/json` |

### 1.2 Autenticación

Envía la clave en **una** de estas formas:

1. **`x-api-key: <clave>`**
2. **`Authorization: Bearer <clave>`**

**Modo A — Clave global (Vercel)**  
- Valor configurado en el proyecto Vercel como **`N8N_LEAD_INGEST_API_KEY`**.  
- **Obligatorio** incluir **`branch_id`** en el JSON (la clave no está atada a una sucursal).

**Modo B — Clave por sucursal (app)**  
- Generada en la aplicación vía RPC `mint_lead_ingest_key` (se guarda solo el hash en `lead_ingest_keys`).  
- **`branch_id` en el cuerpo es opcional**; si lo envías, debe coincidir con la sucursal de esa clave.

### 1.3 Cuerpo (campos)

| Campo | Tipo | Notas |
|-------|------|--------|
| `branch_id` | string | Obligatorio con clave global; con clave mintada, opcional pero debe coincidir si se envía. |
| `phone` | string | **Requerido**; se normaliza a formato Chile (`+56 …`). |
| `full_name` | string | Opcional; si falta o vacío → `"Sin nombre"` (formato título). |
| `rut`, `email`, `region` | string \| null | Opcionales. |
| `source` | string | `web`, `referido`, `walk_in`, `telefono`, `redes_sociales`, `evento`, `otro`, `whatsapp`. Default: `whatsapp`. |
| `status` | string | `nuevo`, `contactado`, `interesado`, `cotizando`, `negociando`, `vendido`, `perdido`, `para_cierre`. Default: `contactado`. |
| `priority` | string | `baja`, `media`, `alta`. Default: `alta`. |
| `payment_type`, `budget` | string / number | Opcionales. |
| `vehicle_interest`, `notes`, `chat_summary` | string | Se vuelcan al campo `notes` del lead (texto combinado). |
| `tags` | array | Si se envía, debe ser array. |
| `state`, `state_confidence`, `state_reason` | string / number | Opcional (estado enriquecido). |
| `update_existing` | boolean | Default **`true`**: si ya existe lead con mismo `phone` y `branch_id`, **actualiza**. Con `false` no entra en esa rama de actualización por teléfono. |

### 1.4 Respuesta exitosa

**HTTP 200**

```json
{
  "ok": true,
  "created": true,
  "data": {
    "id": "…",
    "full_name": "…",
    "phone": "+56 …",
    "status": "contactado",
    "state": null,
    "branch_id": "…",
    "tenant_id": "…",
    "created_at": "…",
    "updated_at": "…"
  }
}
```

- `created: false` cuando se actualizó un lead existente (mismo teléfono + sucursal y `update_existing` no desactiva ese comportamiento).

### 1.5 Errores frecuentes

| HTTP | Situación típica |
|------|------------------|
| `401` | Falta clave o clave inválida. |
| `403` | `branch_id` no coincide con la clave por sucursal. |
| `400` | Cuerpo inválido, teléfono inválido, `tags` no es array, sucursal inexistente, etc. |
| `405` | Método distinto de `POST` (u `OPTIONS` para preflight). |
| `500` | P. ej. variables `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` faltantes en Vercel. |

### 1.6 Ejemplo cURL (clave global + branch)

```bash
curl -sS -X POST "https://skalemotors-v2.vercel.app/api/n8n-lead-ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: TU_N8N_LEAD_INGEST_API_KEY" \
  -d '{
    "branch_id": "UUID-SUCURSAL",
    "phone": "912345678",
    "full_name": "Juan Pérez",
    "source": "whatsapp",
    "status": "contactado"
  }'
```

### 1.7 n8n

- Nodo **HTTP Request**: método `POST`, URL `https://skalemotors-v2.vercel.app/api/n8n-lead-ingest`.
- Autenticación: cabecera `x-api-key` o `Authorization` Bearer con la misma clave que uses en producción.
- Cuerpo: JSON con al menos `phone` y, si usas clave global, `branch_id`.

---

## 2. Búsqueda de listados ChileAutos (scrape)

### 2.1 Endpoint

| | |
|---|---|
| **URL** | `https://skalemotors-v2.vercel.app/api/chileautos-scrape` |
| **Método** | `GET` |

### 2.2 Query

| Parámetro | Requerido | Descripción |
|-----------|-----------|-------------|
| `q` | Sí | Término de búsqueda. |
| `offset` | No | Paginación (default `0`). |

**Ejemplo:**  
`https://skalemotors-v2.vercel.app/api/chileautos-scrape?q=toyota+corolla&offset=0`

### 2.3 Respuesta `200`

```json
{
  "keyword": "toyota corolla",
  "offset": 0,
  "total": 10,
  "listings": [ /* … */ ]
}
```

Cada ítem del listado incluye campos como `id`, `title`, `make`, `model`, `price`, `priceText`, `state`, `details`, `url`, etc.

### 2.4 Errores

| HTTP | Causa típica |
|------|----------------|
| `400` | Falta `q`. |
| `405` | No es `GET`. |
| `502` | ChileAutos respondió error HTTP. |
| `500` | Error interno o de red. |

---

## 3. Claves por sucursal (para usar con este endpoint)

Las claves **mintadas en la app** no se gestionan por Vercel: se crean con RPCs en Supabase desde un usuario autenticado en el CRM, por ejemplo:

| RPC | Uso |
|-----|-----|
| `mint_lead_ingest_key` | Crea clave; el **secreto en claro** solo se muestra al crear. |
| `list_lead_ingest_keys` | Lista metadatos de claves activas por `p_branch_id`. |
| `revoke_lead_ingest_key` | Revoca por `p_key_id`. |

Ese **valor en claro** es el que debes poner en n8n como `x-api-key` / Bearer al llamar a **`https://skalemotors-v2.vercel.app/api/n8n-lead-ingest`** (no hace falta `*.supabase.co` para la petición de ingesta).

---

## 4. Checklist (solo integración Vercel + n8n)

- [ ] URL de ingesta: `https://skalemotors-v2.vercel.app/api/n8n-lead-ingest` (no `lead-create` en Supabase salvo que migres el flujo a ese contrato).
- [ ] En Vercel: `N8N_LEAD_INGEST_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` configurados.
- [ ] Elegir modo: clave global (siempre enviar `branch_id`) o clave mintada por sucursal.
- [ ] Validar `phone` y enums según la tabla del §1.3.

---

*Referencia alineada al despliegue Vercel `skalemotors-v2.vercel.app`. Para Edge Functions, webhooks Meta y demás rutas en `*.supabase.co`, el host y los secretos son distintos.*
