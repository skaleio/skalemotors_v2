# Zernio — Redes sociales (Fase 1 MVP) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admin conecte redes oficiales de la automotora y vendedores conecten redes personales, y publiquen/programen posts vía Zernio desde Skale Motors.

**Architecture:** Edge Functions Deno validan JWT + RBAC y llaman Zernio REST con `ZERNIO_API_KEY`. Postgres cachea profiles, accounts y posts con RLS por `tenant_id` y `scope`. React SPA consume solo `src/lib/services/zernioApi.ts`.

**Tech Stack:** Supabase (Postgres + Edge Functions), React 18 + TanStack Query, Zernio API v1 (`https://zernio.com/api/v1`).

**Spec:** `docs/superpowers/specs/2026-05-30-zernio-redes-sociales-design.md`

**Worktree sugerido:** `feat/zernio-redes-sociales-1` vía `scripts/new-worktree.sh zernio-redes feat/zernio-redes-sociales-1`

---

## Archivos nuevos / modificados (mapa)

| Área | Crear | Modificar |
|------|-------|-----------|
| BD | `supabase/migrations/20260530120000_zernio_social_integration.sql` | — |
| Shared Edge | `supabase/functions/_shared/zernioClient.ts`, `zernioRbac.ts` | — |
| Edge | `zernio-connect-url`, `zernio-accounts-sync`, `zernio-accounts-list`, `zernio-accounts-disconnect`, `zernio-posts-create`, `zernio-posts-list`, `zernio-media-presign` | `supabase/config.toml` (verify_jwt) |
| Frontend lib | `src/lib/services/zernioApi.ts`, `src/lib/zernio/rbac.ts`, `src/lib/zernio/platforms.ts` | `src/lib/types/database.ts` |
| Hooks | `src/hooks/useZernioAccounts.ts`, `src/hooks/useZernioPosts.ts` | — |
| UI | `src/pages/RedesSociales.tsx`, `src/pages/RedesSocialesCallback.tsx`, `src/components/zernio/*` | `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/lib/appRoles.ts` |
| Tests | `src/lib/zernio/rbac.test.ts` | — |

---

## Task 1: Migración SQL + RLS

**Files:**
- Create: `supabase/migrations/20260530120000_zernio_social_integration.sql`

- [ ] **Step 1:** Crear tablas `zernio_org_profiles`, `zernio_user_profiles`, `zernio_accounts`, `zernio_posts` según spec §4.

- [ ] **Step 2:** Habilitar RLS + policies restrictivas + SELECT/INSERT/UPDATE acotadas por scope (spec §4.5).

- [ ] **Step 3:** Triggers `updated_at` y `autofill_tenant_branch_from_user` en tablas con `tenant_id`.

- [ ] **Step 4:** Aplicar migración en proyecto Supabase dev/staging y regenerar o ampliar tipos en `src/lib/types/database.ts`.

```bash
# Tras apply migration (MCP o CLI)
# Regenerar types o pegar bloques Tables manualmente para las 4 tablas
```

---

## Task 2: Cliente Zernio + RBAC compartido (Edge)

**Files:**
- Create: `supabase/functions/_shared/zernioClient.ts`
- Create: `supabase/functions/_shared/zernioRbac.ts`

- [ ] **Step 1:** `zernioClient.ts` — helper `zernioFetch(path, { method, body })` con `Authorization: Bearer ${Deno.env.get("ZERNIO_API_KEY")}` y base `https://zernio.com/api/v1`.

```typescript
export async function zernioFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const apiKey = Deno.env.get("ZERNIO_API_KEY");
  if (!apiKey) throw new Error("ZERNIO_API_KEY no configurada");
  const res = await fetch(`https://zernio.com/api/v1${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { message?: string; error?: string }).message
      ?? (json as { error?: string }).error
      ?? res.statusText;
    throw new Error(msg);
  }
  return json as T;
}
```

- [ ] **Step 2:** `zernioRbac.ts` — constantes `ORG_CONNECT_ROLES`, `ORG_PUBLISH_ROLES`, funciones `canConnectOrg(role)`, `canPublishOrg(role)`, `canManagePersonal(userId, authUid)`.

- [ ] **Step 3:** Helpers `getOrCreateOrgProfile(admin, tenantId)` y `getOrCreateUserProfile(admin, tenantId, userId)` que llaman `POST /profiles` en Zernio si no existe fila local.

---

## Task 3: Edge Function `zernio-connect-url`

**Files:**
- Create: `supabase/functions/zernio-connect-url/index.ts`

- [ ] **Step 1:** POST body `{ scope: "org" | "personal", platform: string }`. Validar JWT + rol (org connect solo admin/gerente/jefe_jefe).

- [ ] **Step 2:** Resolver `profileId` Zernio desde tablas profiles.

- [ ] **Step 3:** `GET /connect/{platform}?profileId=...` vía `zernioFetch` → `{ ok: true, authUrl }`.

- [ ] **Step 4:** Registrar en `supabase/config.toml` con `verify_jwt = true`.

---

## Task 4: Edge Functions accounts (sync, list, disconnect)

**Files:**
- Create: `supabase/functions/zernio-accounts-sync/index.ts`
- Create: `supabase/functions/zernio-accounts-list/index.ts`
- Create: `supabase/functions/zernio-accounts-disconnect/index.ts`

- [ ] **Step 1:** `zernio-accounts-sync` — tras OAuth, `GET /accounts` filtrado por profile, upsert en `zernio_accounts` (scope, platform, ids, display).

- [ ] **Step 2:** `zernio-accounts-list` — SELECT desde BD con filtros RBAC (vendedor: solo personal propio).

- [ ] **Step 3:** `zernio-accounts-disconnect` — `status = 'disconnected'` + delete opcional si Zernio expone endpoint; validar ownership.

---

## Task 5: Edge Functions posts + media

**Files:**
- Create: `supabase/functions/zernio-posts-create/index.ts`
- Create: `supabase/functions/zernio-posts-list/index.ts`
- Create: `supabase/functions/zernio-media-presign/index.ts`

- [ ] **Step 1:** `zernio-media-presign` — proxy `POST /media/presign` con validación MIME.

- [ ] **Step 2:** `zernio-posts-create` — validar accounts, insert local `status: publishing`, llamar Zernio:

```typescript
await zernioFetch("/posts", {
  method: "POST",
  body: {
    content,
    platforms: selectedPlatforms,
    publishNow: !scheduledFor,
    scheduledFor: scheduledFor ?? undefined,
    timezone: "America/Santiago",
    mediaUrls: mediaUrls.length ? mediaUrls : undefined,
  },
});
```

- [ ] **Step 3:** Actualizar fila con `zernio_post_id`, `status: scheduled | published`.

- [ ] **Step 4:** `zernio-posts-list` — paginar por scope + RBAC.

---

## Task 6: Servicio frontend + tests RBAC

**Files:**
- Create: `src/lib/services/zernioApi.ts`
- Create: `src/lib/zernio/rbac.ts`
- Create: `src/lib/zernio/platforms.ts`
- Create: `src/lib/zernio/rbac.test.ts`

- [ ] **Step 1:** `platforms.ts` — array `{ id, label, icon }` para MVP.

- [ ] **Step 2:** `zernioApi.ts` — funciones espejo de Edge (mismo patrón que `metaAdsApi.ts`).

- [ ] **Step 3:** Test Vitest para matriz RBAC (admin puede connect org, vendedor no, etc.).

```typescript
// src/lib/zernio/rbac.test.ts
import { describe, it, expect } from "vitest";
import { canConnectOrg, canPublishOrg } from "./rbac";

describe("zernio rbac", () => {
  it("admin puede conectar org", () => {
    expect(canConnectOrg("admin")).toBe(true);
  });
  it("vendedor no puede conectar org", () => {
    expect(canConnectOrg("vendedor")).toBe(false);
  });
  it("jefe_sucursal puede publicar org", () => {
    expect(canPublishOrg("jefe_sucursal")).toBe(true);
  });
});
```

- [ ] **Step 4:** `npm run test -- src/lib/zernio/rbac.test.ts` → PASS.

---

## Task 7: Hooks React Query

**Files:**
- Create: `src/hooks/useZernioAccounts.ts`
- Create: `src/hooks/useZernioPosts.ts`

- [ ] **Step 1:** `useZernioAccounts(scope)` — queryKey `["zernio-accounts", scope]`.

- [ ] **Step 2:** Mutations `useConnectZernio`, `useSyncZernioAccounts`, `useDisconnectZernioAccount`.

- [ ] **Step 3:** `useZernioPosts(scope)` + `useCreateZernioPost` con invalidación de queries.

---

## Task 8: UI Redes Sociales

**Files:**
- Create: `src/pages/RedesSociales.tsx`
- Create: `src/pages/RedesSocialesCallback.tsx`
- Create: `src/components/zernio/ZernioAccountCard.tsx`
- Create: `src/components/zernio/ZernioConnectGrid.tsx`
- Create: `src/components/zernio/ZernioPostForm.tsx`
- Modify: `src/App.tsx`, `src/components/AppSidebar.tsx`

- [ ] **Step 1:** `RedesSociales.tsx` — Tabs `Automotora` / `Mis cuentas` según rol (`useAuth().user.role` + `canConnectOrg`).

- [ ] **Step 2:** Grid conectar plataforma → invoke connect-url → redirect.

- [ ] **Step 3:** `RedesSocialesCallback.tsx` — leer `scope` de query, llamar sync, navigate back con toast.

- [ ] **Step 4:** `ZernioPostForm` — textarea, selector cuentas conectadas (checkboxes), fecha opcional, botones Publicar ahora / Programar.

- [ ] **Step 5:** Lista historial posts debajo del formulario.

- [ ] **Step 6:** Rutas lazy en `App.tsx`; ítem sidebar "Redes Sociales" visible para vendedor (no agregar a `PHOTOGRAPHER_BLOCKED`).

---

## Task 9: Config, deploy y verificación

**Files:**
- Modify: `.env.example` (comentario documentando que `ZERNIO_API_KEY` es solo Supabase Secret)

- [ ] **Step 1:** Agregar secret `ZERNIO_API_KEY` en Supabase dashboard.

- [ ] **Step 2:** Deploy functions:

```bash
supabase functions deploy zernio-connect-url
supabase functions deploy zernio-accounts-sync
supabase functions deploy zernio-accounts-list
supabase functions deploy zernio-accounts-disconnect
supabase functions deploy zernio-posts-create
supabase functions deploy zernio-posts-list
supabase functions deploy zernio-media-presign
```

- [ ] **Step 3:** Verificación local:

```bash
npm run lint
npm run test
npm run build
```

- [ ] **Step 4:** Smoke manual (checklist):
  - [ ] Admin: conectar Instagram org → aparece en lista
  - [ ] Vendedor: no ve pestaña Automotora / cuentas org
  - [ ] Vendedor: conectar LinkedIn personal → publicar post de prueba
  - [ ] Segundo tenant: no ve accounts del primero

- [ ] **Step 5:** Abrir PR draft `feat(zernio): redes sociales fase 1 MVP`.

---

## Fase 2 (PR separado — no incluir en este plan)

- `GeneradorPosts.tsx` → dialog publicar
- Subida imagen desde URL de vehículo (storage)
- Calendario mensual de posts programados

---

## Self-review (plan vs spec)

| Requisito spec | Task |
|----------------|------|
| Org + personal profiles | Task 1, 2 |
| RBAC matriz | Task 2, 6, 8 |
| OAuth connect | Task 3, 8 |
| Posts create/list | Task 5, 7, 8 |
| Media presign | Task 5 |
| Multi-tenant RLS | Task 1 |
| No API key en cliente | Task 2, 9 |
| Auditoría created_by | Task 1, 5 |

Sin placeholders TBD. Fase 1 acotada; analytics/webhooks en Fase 3+.
