# Integración Zernio — Redes sociales org + personal — Diseño

**Fecha:** 2026-05-30  
**Estado:** Aprobado  
**Referencias:** [Zernio API](https://docs.zernio.com), [Quickstart](https://docs.zernio.com), [Media uploads](https://docs.zernio.com/guides/media-uploads)

---

## 1. Problema y objetivo

Skale Motors ya genera copy para redes en Studio IA (`GeneradorPosts`) pero **no publica** en plataformas reales. Las automotoras necesitan:

1. Que **admin/gerente** conecte y publique en las cuentas **oficiales** de la automotora (Instagram, Facebook, TikTok, etc.).
2. Que **vendedores** conecten y publiquen en sus **cuentas personales** (LinkedIn, Instagram propio) sin mezclar credenciales ni permisos.

**Objetivo:** integrar [Zernio](https://docs.zernio.com) como capa única de OAuth, publicación, programación y (fases posteriores) analytics, respetando multi-tenant y RBAC existente.

### Alcance MVP (Fase 1)

- API key de Skale central (`ZERNIO_API_KEY` en Supabase Secrets).
- Perfil Zernio **org** por `tenant_id` y perfil **personal** por `user_id`.
- OAuth connect / disconnect por plataforma.
- Listar cuentas conectadas según rol y `scope`.
- Crear post: texto, una imagen opcional, publicar ahora o programar.
- Página **Redes Sociales** en la app interna.
- Auditoría: `created_by` en cada post.

### Fuera de alcance MVP (fases 2–4)

- Calendario visual completo, queue recurrente Zernio.
- Analytics por plataforma (Instagram insights, etc.).
- Comments/DMs.
- Webhooks Zernio → actualización de estado (se diseña tabla `status` preparada para ello).
- Cuentas org por `branch_id` (múltiples sucursales con IG distintos).
- Auto-post desde inventario al marcar `publicado_web`.
- BYOK (cada tenant con su API key Zernio).

---

## 2. Modelo de negocio: dos capas

| Capa | `scope` | Quién conecta | Quién publica | Profile Zernio |
|------|---------|---------------|---------------|----------------|
| Automotora | `org` | `admin`, `gerente`, `jefe_jefe` | Mismos + `jefe_sucursal` | 1 por `tenant_id` |
| Personal | `personal` | Cualquier usuario autenticado | Solo el dueño (`user_id`) | 1 por `user_id` |

**Principio:** un vendedor **nunca** ve ni usa cuentas `org`. Un admin puede tener además sus cuentas `personal` en la misma UI (pestañas).

---

## 3. Arquitectura

### 3.1 Patrón (igual que Meta Ads / WhatsApp)

```
[React SPA] → src/lib/services/zernioApi.ts
         → supabase.functions.invoke (JWT usuario)
         → Edge Functions Deno (validan auth + tenant + RBAC)
         → Zernio API https://zernio.com/api/v1 (Bearer ZERNIO_API_KEY)
         → Postgres (cache local + auditoría)
```

- **Nunca** exponer `ZERNIO_API_KEY` al browser.
- **Nunca** confiar en `tenant_id` / `user_id` del body sin cruzar con `auth.uid()` y tabla `users`.
- Edge Functions usan `service_role` solo para upsert tras validar JWT (mismo patrón que `meta-ads-connect`).

### 3.2 Mapeo Zernio ↔ Skale

| Concepto Zernio | Skale |
|-----------------|-------|
| Profile | `zernio_org_profiles` o `zernio_user_profiles` |
| Account (post-OAuth) | fila en `zernio_accounts` |
| Post | fila en `zernio_posts` + `createPost` API |
| Connect URL | `GET /v1/connect/{platform}?profileId=` |

Convención de `profileId` en Zernio (creados por Skale vía API):

- Org: `skale-org-{tenant_uuid}` (nombre visible: nombre del tenant).
- Personal: `skale-user-{user_uuid}` (nombre: nombre del usuario).

### 3.3 Flujo OAuth

1. Usuario elige plataforma + scope (`org` | `personal`) en UI.
2. `zernio-connect-url` valida rol → obtiene/crea profile Zernio → llama `connect.getConnectUrl` → devuelve `authUrl`.
3. Frontend redirige `window.location.href = authUrl`.
4. Zernio redirige a **callback** configurado en dashboard Zernio:  
   `{APP_ORIGIN}/app/redes-sociales/callback?scope=org|personal`
5. Página callback invoca `zernio-accounts-sync` (lista accounts del profile y hace upsert en BD).
6. Usuario vuelve a la pestaña correspondiente con toast de éxito.

**Nota operativa:** registrar en Zernio el redirect URI de producción y preview (Vercel).

---

## 4. Modelo de datos

Migración: `supabase/migrations/20260530120000_zernio_social_integration.sql`

### 4.1 `zernio_org_profiles`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL UNIQUE | FK `tenants` |
| `zernio_profile_id` | text NOT NULL UNIQUE | ID devuelto por Zernio |
| `created_at` / `updated_at` | timestamptz | |

### 4.2 `zernio_user_profiles`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | FK `tenants` |
| `user_id` | uuid NOT NULL UNIQUE | FK `users` / `auth.users` |
| `zernio_profile_id` | text NOT NULL UNIQUE | |
| `created_at` / `updated_at` | timestamptz | |

### 4.3 `zernio_accounts`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | |
| `scope` | text NOT NULL | `'org'` \| `'personal'` |
| `user_id` | uuid NULL | NULL si `org`; `auth.uid()` si `personal` |
| `zernio_account_id` | text NOT NULL | ID Zernio `acc_*` |
| `platform` | text NOT NULL | `instagram`, `linkedin`, … |
| `display_name` | text NULL | |
| `username` | text NULL | |
| `avatar_url` | text NULL | |
| `status` | text NOT NULL DEFAULT `'active'` | `active` \| `disconnected` \| `error` |
| `last_error` | text NULL | |
| `connected_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |

**UNIQUE:** `(tenant_id, scope, zernio_account_id)`  
**CHECK:** `(scope = 'org' AND user_id IS NULL) OR (scope = 'personal' AND user_id IS NOT NULL)`

### 4.4 `zernio_posts`

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | |
| `scope` | text NOT NULL | |
| `created_by` | uuid NOT NULL | |
| `zernio_post_id` | text NULL | Tras crear en Zernio |
| `content` | text NOT NULL | |
| `media_urls` | jsonb DEFAULT `[]` | URLs públicas post-upload |
| `platforms` | jsonb NOT NULL | `[{platform, accountId}]` |
| `scheduled_for` | timestamptz NULL | |
| `timezone` | text DEFAULT `'America/Santiago'` | |
| `status` | text NOT NULL | `draft` \| `scheduled` \| `publishing` \| `published` \| `failed` |
| `last_error` | text NULL | |
| `published_at` | timestamptz NULL | |
| `created_at` / `updated_at` | timestamptz | |

Índices: `(tenant_id, scope, created_at DESC)`, `(created_by, created_at DESC)`.

### 4.5 RLS

Todas las tablas: `ENABLE ROW LEVEL SECURITY`.

**Restrictiva (ALL):**

```sql
USING (current_is_legacy_protected() OR tenant_id = current_tenant_id())
```

**SELECT `zernio_accounts`:**

- `org`: cualquier usuario del tenant con rol en lista org-publishers (ver §5).
- `personal`: solo `user_id = auth.uid()`.

**INSERT/UPDATE/DELETE `zernio_accounts`:**

- `org` connect/disconnect: solo roles connect-org (§5).
- `personal`: solo `user_id = auth.uid()`.

**`zernio_posts`:**

- SELECT org: roles que pueden publicar en org.
- SELECT personal: `created_by = auth.uid()` OR roles gerenciales (solo lectura equipo — **MVP: solo `created_by`** para personal).
- INSERT: validar en Edge Function; RLS INSERT con `created_by = auth.uid()` y `tenant_id` coherente.

Triggers: `autofill_tenant_branch_from_user` en tablas con `tenant_id` (sin `branch_id` obligatorio en MVP).

---

## 5. Matriz RBAC

Roles Skale: `admin`, `gerente`, `jefe_jefe`, `jefe_sucursal`, `vendedor`, `financiero`, `servicio`, `inventario`, `fotografo`.

| Acción | Roles permitidos |
|--------|------------------|
| Conectar cuenta **org** | `admin`, `gerente`, `jefe_jefe` |
| Desconectar cuenta **org** | `admin`, `gerente`, `jefe_jefe` |
| Publicar en cuenta **org** | `admin`, `gerente`, `jefe_jefe`, `jefe_sucursal` |
| Ver cuentas **org** | mismos que publicar + connect |
| Conectar cuenta **personal** | todos excepto usuarios sin sesión |
| Publicar **personal** | dueño de la cuenta |
| Ver posts **org** | roles que publican en org |
| Ver posts **personal** | solo `created_by` (MVP) |

Implementación: helper compartido en `supabase/functions/_shared/zernioRbac.ts` + espejo en `src/lib/zernio/rbac.ts` para UI (ocultar botones).

---

## 6. Edge Functions (MVP)

| Función | Método | Descripción |
|---------|--------|-------------|
| `zernio-connect-url` | POST | `{ scope, platform }` → `{ authUrl }` |
| `zernio-accounts-sync` | POST | `{ scope }` → sincroniza accounts desde Zernio |
| `zernio-accounts-list` | POST | `{ scope }` → lista desde BD (filtrada RBAC) |
| `zernio-accounts-disconnect` | POST | `{ scope, zernio_account_id }` |
| `zernio-posts-create` | POST | contenido, accounts, schedule o publishNow |
| `zernio-posts-list` | POST | `{ scope, limit? }` |
| `zernio-media-presign` | POST | proxy a Zernio presign (subida desde browser vía PUT a URL firmada) |

Todas con `verify_jwt: true` en `supabase/config.toml`.

**`zernio-posts-create` validaciones:**

1. Usuario autenticado y `tenant_id` del perfil.
2. Cada `accountId` existe en `zernio_accounts` del tenant, scope correcto, y usuario tiene permiso.
3. Llamada Zernio `POST /v1/posts` con API key.
4. Upsert `zernio_posts` con estado inicial.

**Errores:** respuestas `{ ok: false, error: string }` en español cuando sea mensaje de usuario.

---

## 7. Frontend

### 7.1 Rutas

| Ruta | Componente | Acceso |
|------|------------|--------|
| `/app/redes-sociales` | `RedesSociales.tsx` | Todos (excepto bloqueados por rol fotógrafo — **incluir vendedor**) |
| `/app/redes-sociales/callback` | `RedesSocialesCallback.tsx` | Autenticado |

Registrar en `App.tsx` y `AppSidebar` (icono `Share2` o `Megaphone`), categoría Marketing o Herramientas.

### 7.2 UI — Admin/gerente

Pestañas:

1. **Automotora** — grid de plataformas, conectar, listar cuentas, formulario rápido de post, historial org.
2. **Mis cuentas** — mismo para `personal`.

### 7.3 UI — Vendedor

Solo vista **Mis cuentas** (sin pestaña org).

### 7.4 Servicio y hooks

- `src/lib/services/zernioApi.ts` — invoke Edge Functions.
- `src/hooks/useZernioAccounts.ts`, `useZernioPosts.ts` — React Query.
- `src/lib/zernio/platforms.ts` — lista de plataformas MVP: `instagram`, `facebook`, `linkedin`, `tiktok`, `twitter` (API value `twitter`).

### 7.5 Studio IA (Fase 2)

`GeneradorPosts.tsx`: botón "Publicar" que abre dialog con selector scope + cuentas + publish/schedule.

---

## 8. Seguridad

- `ZERNIO_API_KEY` solo en Supabase Secrets y Edge runtime.
- Validar que `accountId` en posts pertenezca al tenant y scope antes de llamar Zernio.
- Callback OAuth: solo usuarios logueados; no pasar secrets en query string.
- Media presign: validar `contentType` permitido (jpeg, png, webp, mp4).
- Rate limit básico en `zernio-posts-create` (opcional fase 2): máx. N posts/hora por usuario.
- **Multi-tenant:** tests manuales con dos tenants; un usuario de Miami no debe listar accounts de Hessen.

---

## 9. Configuración operativa

1. Cuenta Zernio de Skale Motors → API key en Supabase: `ZERNIO_API_KEY`.
2. Redirect URIs en dashboard Zernio:
   - `https://app.skalemotors.cl/app/redes-sociales/callback`
   - `http://localhost:5173/app/redes-sociales/callback` (dev)
3. Desplegar Edge Functions tras migración.

---

## 10. Fases de producto

| Fase | Entregable |
|------|------------|
| **1 (MVP)** | Connect, list, disconnect, create/list posts, UI Redes Sociales |
| **2** | Media desde inventario, calendario, Studio IA publish |
| **3** | Webhooks Zernio, sync estado, promocionar vehículo |
| **4** | Analytics, queue, comments (si hay demanda) |

---

## 11. Criterios de éxito MVP

- Admin conecta Instagram oficial de la automotora y publica un post de prueba.
- Vendedor conecta LinkedIn personal y publica sin ver cuentas org.
- Usuario de otro tenant no ve ni publica en accounts ajenos (RLS + Edge).
- `npm run build` y `npm run test` verdes en el PR de Fase 1.

---

## 12. Decisiones explícitas

| Decisión | Elección |
|----------|----------|
| API key | Central Skale (no BYOK en MVP) |
| Org scope | Por `tenant_id`, no `branch_id` |
| SDK | `fetch` directo a Zernio REST en Edge (sin depender de npm en Deno); opcional `@zernio/node` solo si se valida compatibilidad Deno |
| Desconectar | Marcar `status = disconnected` en BD; opcional llamar API Zernio si existe endpoint |
| Idioma UI | Español (Chile) |
