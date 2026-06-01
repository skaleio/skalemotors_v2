# Vitrina pública multi-tenant + Web Builder — Diseño

**Fecha:** 2026-05-28
**Estado:** Aprobado (Enfoque A + rendering SSR dedicado)
**Autor:** Antonio + asistente

---

## 1. Problema y objetivo

Cada automotora cliente de Skalemotors hoy paga un software externo (tipo Wix) para
tener su sitio web público con vitrina de autos. La primera automotora a migrar
(`miamimotors.cl`) ya tiene su dominio comprado apuntando a ese builder.

**Objetivo:** que cada tenant de Skalemotors pueda tener una **vitrina pública** de su
inventario, con dominio propio, donde el resultado sea mejor que el actual (rápido,
indexable en Google, lindo) y donde **los autos y sus fotos salgan en vivo desde el
inventario que ya gestiona en Skalemotors**, sin re-subir nada.

### Qué SÍ entra en alcance

- Vitrina pública por tenant: home + listado de autos + ficha de auto + contacto.
- Resolución de tenant por hostname (subdominio automático + dominio propio).
- Configuración del sitio desde la app interna (tema, logo, colores, textos, contacto, SEO).
- Publicación de autos a la web con un toggle desde el inventario (fotos incluidas, sin re-subida).
- Captura de leads desde la vitrina hacia el CRM existente (tabla `leads`).
- SEO real (SSR) + meta/Open Graph por auto.

### Qué NO entra (YAGNI)

- Editor visual drag-and-drop (Enfoque B). Se deja la puerta abierta, no se construye ahora.
- Páginas libres arbitrarias / CMS de blog.
- E-commerce / pago online / reserva con seña.
- Multi-idioma.

---

## 2. Decisiones de arquitectura

### 2.1 Rendering: app pública SSR dedicada (no dentro de la SPA actual)

La app interna de Skalemotors es una SPA Vite pensada para usuarios autenticados
(bundle pesado, render en cliente, SEO nulo). Servir una vitrina pública desde ahí
daría mal SEO y carga lenta.

**Decisión:** la vitrina pública es una **app Next.js separada** (`apps/vitrina/`),
desplegada en el mismo proyecto Vercel/equipo, con SSR + ISR. Comparte el backend
Supabase pero no comparte bundle con la app interna.

- Ventaja: SEO real, carga rápida, OG por auto, bundle chico, app interna intacta.
- Costo: una segunda app a mantener y desplegar. Aceptado.

### 2.2 Acceso a datos público sin romper RLS

RLS bloquea hoy **todo** acceso anónimo (correcto y se mantiene). La vitrina NO usa
`anon` directo contra tablas. Lee a través de **Edge Functions con `service_role`** que
resuelven el tenant por hostname y devuelven solo datos públicos:

- `public-vitrina` — dado un hostname, devuelve config del sitio + autos publicados de ese tenant.
- `vitrina-lead` — recibe un formulario de contacto y crea un lead en el CRM de ese tenant.

Ambas funciones son el único portón público. Nunca exponen datos de otros tenants ni
campos sensibles (costo, margen, owner, documentos).

### 2.3 Dominios en Vercel

- **Subdominio automático:** wildcard `*.skalemotors.cl` → app vitrina. Cada tenant
  obtiene `{slug}.skalemotors.cl` al crear su sitio, instantáneo.
- **Dominio propio:** se agrega vía API de Vercel a la app vitrina + verificación DNS.
  Para migrar `miamimotors.cl`, se repunta el DNS desde el builder viejo hacia Vercel.

El mapeo hostname → tenant vive en `tenant_domains`, no en Vercel (Vercel solo enruta
tráfico hacia la app; la app resuelve el tenant por el `Host` header).

---

## 3. Modelo de datos

Todas las tablas nuevas siguen la regla multi-tenant del repo: `tenant_id NOT NULL`,
RLS con policy restrictiva + policy de SELECT, y trigger `autofill_tenant_branch_from_user`.

### 3.1 `tenant_sites` (1 fila por tenant)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL → tenants(id) | UNIQUE (1 sitio por tenant en MVP) |
| `is_published` | boolean NOT NULL default false | si la vitrina está online |
| `theme` | text NOT NULL default 'moderna' | `moderna` \| `tradicional` \| `premium` |
| `site_name` | text | nombre comercial mostrado |
| `logo_url` | text | logo (storage público) |
| `primary_color` | text default '#7c3aed' | color de marca |
| `secondary_color` | text | acento |
| `hero_title` | text | |
| `hero_subtitle` | text | |
| `hero_image_url` | text | |
| `about_text` | text | sección "nosotros" |
| `whatsapp_phone` | text | para botón WhatsApp |
| `contact_email` | text | |
| `contact_phone` | text | |
| `address` | text | |
| `social` | jsonb default '{}' | {instagram, facebook, tiktok, youtube} |
| `sections` | jsonb default '{}' | toggles: {features, vehicles, videos, contact, marketing} |
| `videos` | jsonb default '[]' | URLs de videos (YouTube) |
| `seo_title` | text | |
| `seo_description` | text | |
| `created_at` / `updated_at` | timestamptz | |

### 3.2 `tenant_domains`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL → tenants(id) | |
| `domain` | text NOT NULL UNIQUE | hostname normalizado en minúsculas, ej. `www.miamimotors.cl` o `miamimotors.skalemotors.cl` |
| `kind` | text NOT NULL | `subdomain` \| `custom` |
| `is_primary` | boolean NOT NULL default false | dominio canónico para redirects/SEO |
| `verification_status` | text NOT NULL default 'pending' | `pending` \| `verified` \| `error` |
| `vercel_domain_id` | text | id devuelto por API de Vercel (solo `custom`) |
| `created_at` / `updated_at` | timestamptz | |

Índice único parcial: a lo sumo un `is_primary = true` por tenant.

### 3.3 `vehicles.publicado_web` (columna nueva)

`boolean NOT NULL default false`. Independiente de `publicado` (que es flag interno de
planilla) y de los listings de marketplaces. Solo los autos con `publicado_web = true` y
`status` vendible aparecen en la vitrina.

---

## 4. Edge Functions

### 4.1 `public-vitrina` (GET, sin auth)

Entrada: hostname (query `?host=` o header `x-forwarded-host`) + path opcional
(`/` | `/vehiculos` | `/vehiculo/{id}`).

Lógica:
1. Normaliza hostname → busca en `tenant_domains` (verified) → `tenant_id`.
2. Si no existe o no publicado → 404.
3. Devuelve JSON:
   - `site`: fila de `tenant_sites` (sin campos internos).
   - `branches`: sucursales públicas (name, address, phone, city, region).
   - `vehicles`: autos con `publicado_web = true` y `status` vendible, solo campos
     públicos: id, make, model, year, price, mileage, fuel, transmission, color,
     category, condition, description, features, images, primary_image_url, carroceria.
   - **Excluye** cost, margin, owner_*, documents, vin completo.
4. Cache headers (`s-maxage`) para que Vercel/CDN e ISR cacheen.

`service_role`, scoping estricto por `tenant_id` resuelto del hostname. Nunca acepta
`tenant_id` del cliente.

### 4.2 `vitrina-lead` (POST, sin auth)

Entrada: hostname + `{ full_name, phone, email?, message?, vehicle_id? }` + token anti-spam.

Lógica:
1. Resuelve `tenant_id` por hostname (igual que arriba).
2. Anti-spam: honeypot + rate-limit por IP + validación de formato (RUT/teléfono CL).
3. Inserta en `leads`: `source='web'`, `status='nuevo'`, `priority='media'`,
   `tenant_id` resuelto, `branch_id` (default del tenant o el del vehículo),
   `raw_message`, `preferred_vehicle_id = vehicle_id`.
4. Devuelve ok. (Las automatizaciones de leads existentes se disparan solas.)

---

## 5. App interna (cambios)

Nueva sección **"Mi Web"** (ruta `/app/website`, registrada en `App.tsx`, permiso de
gerente/admin). Reemplaza el stub muerto `WebsiteBuilder.tsx`. Contiene:

- **Configuración:** formulario (React Hook Form + Zod) que lee/escribe `tenant_sites`
  vía un servicio nuevo `src/lib/services/tenantSite.ts`. Selector de tema con preview.
- **Dominios:** alta del subdominio automático y conexión de dominio propio (muestra los
  registros DNS a crear y el estado de verificación). Llama a una Edge Function
  `vitrina-domain` que habla con la API de Vercel.
- **Autos en la web:** vista del inventario con toggle `publicado_web` (individual y
  masivo). Reutiliza el patrón de "publicar en marketplace" ya existente en `Inventory.tsx`.

Toda escritura pasa por servicios en `src/lib/services/` (regla del repo). RLS garantiza
que cada gerente solo ve/edita su tenant.

---

## 6. App vitrina (Next.js, `apps/vitrina/`)

- Rutas: `/` (home), `/vehiculos` (listado + filtros), `/vehiculo/[id]` (ficha), contacto.
- Resuelve tenant por `Host` header en el servidor; llama a `public-vitrina`.
- 3 temas como sets de componentes (`moderna`/`tradicional`/`premium`) que consumen el
  mismo contrato de datos.
- ISR con revalidación + `tag`/`revalidate` para refrescar cuando cambian autos.
- SEO: `<title>`, meta description, Open Graph por auto (imagen del auto), sitemap,
  robots, datos estructurados `schema.org/Vehicle`.
- Formulario de contacto → `vitrina-lead`.
- Fotos: directo desde el bucket público `vehicles` (ya es `public`), con
  `next/image` para optimización.

---

## 7. Aislamiento multi-tenant (crítico)

- Tablas nuevas con `tenant_id NOT NULL` + RLS restrictiva + SELECT + trigger autofill.
- Lectura pública SOLO vía Edge Function con `service_role`, scoping por hostname→tenant.
  Jamás se confía en `tenant_id` que venga del cliente.
- La vitrina nunca recibe campos sensibles (costo, margen, datos del dueño, documentos).
- Verificación: simular `miamimotors.cl` y confirmar que jamás devuelve autos de Hessen.

---

## 8. Flujo de migración de `miamimotors.cl`

1. El gerente configura su sitio en "Mi Web" y publica sus autos.
2. Conecta el dominio propio → la app muestra los registros DNS (A/CNAME) de Vercel.
3. En el registrador del dominio, se cambian los DNS desde el builder viejo a Vercel.
4. Vercel emite el SSL; `verification_status` pasa a `verified`.
5. Se da de baja el software externo.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Fuga de datos entre tenants | Único portón = Edge Function scoped por hostname; sin anon RLS. |
| SEO/performance pobre | App SSR dedicada + ISR + imágenes optimizadas. |
| Downtime al migrar el dominio | Configurar y verificar todo en Vercel antes de cambiar DNS; TTL bajo. |
| Segunda app que mantener | Contrato de datos estable vía Edge Function; temas desacoplados. |
| Abuso del form de contacto | Honeypot + rate-limit por IP + validación. |

---

## 10. Orden de implementación (resumen; el plan detallado va aparte)

1. **Backend (BD + Edge Functions de lectura/lead)** — base sobre la que todo se apoya.
2. **App interna "Mi Web"** — configuración + toggle de autos.
3. **App vitrina Next.js** — un tema primero (`moderna`), luego los otros dos.
4. **Dominios** — subdominio automático, luego dominio propio + flujo de verificación.
5. **Migración real de `miamimotors.cl`.**
