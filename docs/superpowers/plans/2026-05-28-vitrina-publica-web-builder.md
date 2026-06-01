# Vitrina pública + Web Builder — Plan de implementación

> **Para workers agénticos:** este plan está dividido en fases. La Fase 0 (backend)
> ya está EJECUTADA. Cada fase produce software funcional y testeable por sí sola.
> Trabajar cada fase en su propio worktree + PR draft (ver CLAUDE.md §10).

**Goal:** Cada tenant de Skalemotors puede tener una vitrina pública de su inventario,
con dominio propio, alimentada en vivo desde el inventario, que captura leads al CRM.

**Architecture:** App pública SSR (Next.js) separada de la SPA interna. Lee datos solo
vía Edge Functions con `service_role` scopeadas por hostname (RLS intacto, sin anon).
La SPA interna gana una sección "Mi Web" para configurar el sitio y publicar autos.

**Tech Stack:** Supabase (Postgres + Edge Functions Deno), React/Vite (app interna),
Next.js 14 App Router + ISR (app vitrina), Vercel (hosting + dominios), Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-28-vitrina-publica-web-builder-design.md`

---

## Fase 0 — Backend (BD + Edge Functions) — ✅ HECHO

- [x] Migración `supabase/migrations/20260528170000_vitrina_publica_web_builder.sql`
      aplicada al proyecto Supabase. Crea `tenant_sites`, `tenant_domains`,
      `vehicles.publicado_web`, con RLS (restrictiva + permisivas) + triggers autofill/updated_at.
- [x] Edge Function `supabase/functions/public-vitrina/index.ts` (lectura pública por hostname).
- [x] Edge Function `supabase/functions/vitrina-lead/index.ts` (captura de leads anti-spam).

**Pendientes de Fase 0 (hacer en worktree, NO en main):**

- [ ] **Regenerar tipos TS.** OJO: hay migraciones sin aplicar (`daily_sales_reports`,
      `leads_assigned_to_team_scope`) y `database.ts` con cambios sin commitear. Primero
      aplicar esas migraciones, luego regenerar. Mientras tanto, agregar a mano estos tipos
      en `src/lib/types/database.ts` (tabla `Tables`):

```ts
tenant_sites: {
  Row: {
    id: string; tenant_id: string; is_published: boolean;
    theme: 'moderna' | 'tradicional' | 'premium';
    site_name: string | null; logo_url: string | null;
    primary_color: string; secondary_color: string | null;
    hero_title: string | null; hero_subtitle: string | null; hero_image_url: string | null;
    about_text: string | null; whatsapp_phone: string | null;
    contact_email: string | null; contact_phone: string | null; address: string | null;
    social: Json; sections: Json; videos: Json;
    seo_title: string | null; seo_description: string | null;
    created_at: string; updated_at: string;
  };
  Insert: { tenant_id?: string | null; /* resto opcional */ [k: string]: unknown };
  Update: { [k: string]: unknown };
};
tenant_domains: {
  Row: {
    id: string; tenant_id: string; domain: string;
    kind: 'subdomain' | 'custom'; is_primary: boolean;
    verification_status: 'pending' | 'verified' | 'error';
    vercel_domain_id: string | null; created_at: string; updated_at: string;
  };
  Insert: { tenant_id?: string | null; domain: string; kind: 'subdomain' | 'custom'; [k: string]: unknown };
  Update: { [k: string]: unknown };
};
// vehicles.Row: agregar -> publicado_web: boolean;
```

- [ ] **Desplegar Edge Functions** (cuando exista la app vitrina que las consume):

```bash
supabase functions deploy public-vitrina --no-verify-jwt
supabase functions deploy vitrina-lead --no-verify-jwt
```

  Son públicas (sin JWT): implementan su propio modelo de acceso (scoping por hostname,
  honeypot, read-only). Verificar que `SUPABASE_SERVICE_ROLE_KEY` esté en los secrets.

- [ ] **Smoke test de aislamiento** (crítico, regla multi-tenant). Crear un `tenant_domains`
      verificado de prueba y confirmar que `public-vitrina` solo devuelve autos de ese tenant:

```bash
curl "https://<project>.functions.supabase.co/public-vitrina?host=miamimotors.skalemotors.cl&path=vehicles"
# Debe devolver SOLO autos del tenant dueño del dominio, nunca de otro.
```

---

## Fase 1 — App interna: sección "Mi Web"

**Objetivo:** que el gerente configure su sitio y publique autos desde la SPA actual.

### Task 1.1: Servicio `tenantSite`

**Files:**
- Create: `src/lib/services/tenantSite.ts`

- [ ] Crear el servicio (toda llamada a Supabase pasa por servicios, regla del repo).
      Funciones: `getMySite()`, `upsertMySite(payload)`, `listMyDomains()`,
      `addDomain({domain, kind})`, `setPrimaryDomain(id)`, `deleteDomain(id)`.
      Insertar SIEMPRE con `tenant_id` del `useAuth().user` (regla multi-tenant), aunque
      el trigger lo autocomplete.

```ts
import { supabase } from '@/integrations/supabase/client';

export async function getMySite() {
  const { data, error } = await supabase.from('tenant_sites').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertMySite(tenantId: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('tenant_sites')
    .upsert({ tenant_id: tenantId, ...payload }, { onConflict: 'tenant_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
// listMyDomains / addDomain / setPrimaryDomain / deleteDomain análogos sobre tenant_domains
```

### Task 1.2: Hook `useTenantSite`

**Files:**
- Create: `src/hooks/useTenantSite.ts`

- [ ] React Query: `useTenantSite()` (query) + `useUpsertTenantSite()` (mutation con
      invalidación). Mismo patrón que los hooks existentes (`useLeads`, etc.).

### Task 1.3: Formulario de configuración (Zod + RHF)

**Files:**
- Create: `src/components/website/SiteConfigForm.tsx`
- Create: `src/lib/validation/tenantSite.ts` (schema Zod)

- [ ] Schema Zod: `theme`, `site_name`, `primary_color` (hex), `hero_title`,
      `hero_subtitle`, `whatsapp_phone`, `contact_email`, `contact_phone`, `address`,
      `social` (instagram/facebook/tiktok/youtube urls opcionales), `sections` (toggles),
      `seo_title`, `seo_description`. Validaciones: color hex, urls, email.
- [ ] Form con shadcn/ui + selector de tema con preview. Subida de logo/hero a bucket
      `vehicles` (ya público) o nuevo bucket `branding` (decisión: reusar `vehicles/branding/`).

### Task 1.4: Gestión de dominios

**Files:**
- Create: `src/components/website/DomainsManager.tsx`

- [ ] UI: crear subdominio automático (`{slug}.skalemotors.cl`), conectar dominio propio
      (input + estado de verificación + instrucciones DNS). Llama Edge Function `vitrina-domain`
      (Fase 3). En MVP de esta fase, solo persistir en `tenant_domains` y mostrar estado.

### Task 1.5: Publicar autos a la web

**Files:**
- Modify: `src/pages/Inventory.tsx` (reutilizar patrón de "publicar en marketplace", ~líneas 557-579, 1743-1777)
- Create: `src/components/website/PublishToWebToggle.tsx`

- [ ] Toggle `publicado_web` por vehículo (individual) + acción masiva. Servicio:
      `src/lib/services/vehicles.ts` -> agregar `setPublicadoWeb(vehicleId, value)` y
      `bulkSetPublicadoWeb(ids, value)`.

### Task 1.6: Página y ruta "Mi Web"

**Files:**
- Modify: `src/pages/WebsiteBuilder.tsx` (reemplazar stub muerto)
- Modify: `src/App.tsx` (registrar ruta `/app/website` con ProtectedRoute, permiso gerente/admin)
- Modify: `src/components/AppSidebar.tsx` (entrada de menú "Mi Web")

- [ ] Componer `SiteConfigForm` + `DomainsManager` + acceso al toggle de autos en tabs.
      Gate de rol: solo `admin`/`gerente` (a nivel ruta; RLS ya protege a nivel tenant).
- [ ] Verificar: `npm run lint && npm run build`.

---

## Fase 2 — App vitrina SSR (Next.js)

**Objetivo:** sitio público rápido e indexable que consume las Edge Functions.

### Task 2.1: Scaffold del proyecto

**Files:**
- Create: `apps/vitrina/` (Next.js 14 App Router, TypeScript, Tailwind)
- Create: `apps/vitrina/vercel.json`, `.env.example`

- [ ] `npx create-next-app@latest apps/vitrina --ts --tailwind --app --no-src-dir`.
      Variables: `VITRINA_FUNCTIONS_URL` (base de Edge Functions), `SUPABASE_ANON_KEY`
      (solo para headers de la function), `NEXT_PUBLIC_DEFAULT_HOST`.

### Task 2.2: Cliente de datos

**Files:**
- Create: `apps/vitrina/lib/vitrinaApi.ts`

- [ ] Funciones server-side: `fetchHome(host)`, `fetchVehicles(host)`, `fetchVehicle(host,id)`,
      `submitLead(host, payload)`. Llaman a `public-vitrina` / `vitrina-lead` con
      `fetch(..., { next: { revalidate: 60 } })`. El `host` se obtiene de
      `headers().get('host')` en server components.

### Task 2.3: Resolución de host + layout

**Files:**
- Create: `apps/vitrina/app/layout.tsx`, `apps/vitrina/app/page.tsx`

- [ ] `page.tsx` (home): lee host, `fetchHome`, renderiza el tema según `site.theme`.
      `generateMetadata` para SEO (title/description del sitio).
- [ ] Si la function devuelve 404 -> Next `notFound()`.

### Task 2.4: Temas (empezar por "moderna")

**Files:**
- Create: `apps/vitrina/components/themes/moderna/*` (Hero, FeaturesGrid, VehicleGrid, VehicleCard, ContactSection, Footer)
- Create: `apps/vitrina/components/themes/index.ts` (mapa theme -> componentes)

- [ ] Implementar tema `moderna` completo, responsive, con `next/image` apuntando al
      bucket público `vehicles`. Color de marca desde `site.primary_color` (CSS var).
- [ ] (Después) `tradicional` y `premium` consumiendo el MISMO contrato de datos.

### Task 2.5: Listado y ficha de auto

**Files:**
- Create: `apps/vitrina/app/vehiculos/page.tsx`
- Create: `apps/vitrina/app/vehiculo/[id]/page.tsx`

- [ ] Listado con filtros básicos (marca, precio, año) client-side sobre los datos SSR.
- [ ] Ficha: galería de `images`, specs, botón WhatsApp, formulario "consultar".
      `generateMetadata` con Open Graph (imagen = `primary_image_url`) y JSON-LD
      `schema.org/Vehicle`.

### Task 2.6: Formulario de contacto -> lead

**Files:**
- Create: `apps/vitrina/components/LeadForm.tsx`
- Create: `apps/vitrina/app/api/lead/route.ts` (proxy a `vitrina-lead`, pasa el host)

- [ ] Honeypot oculto (`company`), validación, POST a `/api/lead`. Toast de éxito.

### Task 2.7: SEO base

**Files:**
- Create: `apps/vitrina/app/sitemap.ts`, `apps/vitrina/app/robots.ts`

- [ ] Sitemap dinámico por host (home + /vehiculos + cada /vehiculo/[id]). Robots permisivo.

---

## Fase 3 — Dominios (Vercel)

**Objetivo:** subdominio automático + conexión de dominio propio con verificación.

### Task 3.1: Edge Function `vitrina-domain`

**Files:**
- Create: `supabase/functions/vitrina-domain/index.ts`

- [ ] CON auth (gerente/admin del tenant). Acciones: `add` (registra en `tenant_domains` +
      llama API de Vercel `POST /v10/projects/{projectId}/domains` para `custom`),
      `verify` (consulta estado en Vercel y actualiza `verification_status`),
      `remove`. Secrets: `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID_VITRINA`, `VERCEL_TEAM_ID`.
      Validar SIEMPRE que el dominio pertenezca al tenant del usuario.

### Task 3.2: Wildcard de subdominios

- [ ] En Vercel, agregar dominio `*.skalemotors.cl` al proyecto `vitrina` (una sola vez).
      Configurar DNS wildcard CNAME -> Vercel. Documentar en `docs/guides/`.

### Task 3.3: Conexión de dominio propio (UI + flujo)

**Files:**
- Modify: `src/components/website/DomainsManager.tsx`

- [ ] Mostrar registros DNS (A `76.76.21.21` / CNAME `cname.vercel-dns.com`) y polling de
      `verify`. Estado `verified` -> sitio online en el dominio propio.

---

## Fase 4 — Migración real de miamimotors.cl

- [ ] Configurar sitio + publicar autos (Fase 1).
- [ ] Agregar `miamimotors.cl` y `www.miamimotors.cl` como dominio `custom` (Fase 3).
- [ ] Bajar el TTL del DNS en el registrador (anticipado).
- [ ] Cambiar A/CNAME desde el builder viejo a Vercel. Esperar `verified` + SSL.
- [ ] Verificar la web en producción (Lighthouse, OG, formulario -> lead en CRM).
- [ ] Dar de baja el software externo.

---

## Self-Review (cobertura vs spec)

- §3 modelo de datos -> Fase 0 ✅ (tablas + columna creadas y verificadas).
- §4 Edge Functions lectura/lead -> Fase 0 ✅ (scaffold) + deploy pendiente.
- §5 app interna "Mi Web" -> Fase 1.
- §6 app vitrina SSR + temas + SEO -> Fase 2.
- §7 aislamiento multi-tenant -> RLS en Fase 0 + smoke test de aislamiento listado.
- §2.3 / §8 dominios y migración -> Fase 3 + Fase 4.

Sin placeholders pendientes de decisión: tema inicial = `moderna`; branding en bucket
`vehicles/branding/`; gate de rol gerente/admin a nivel ruta.
