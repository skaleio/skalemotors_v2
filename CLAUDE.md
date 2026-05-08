# CLAUDE.md — Skale Motors v2

Guía operativa para Claude Code en este repositorio. Lee esto **antes** de actuar.

---

## Eficiencia de Tokens

- Piensa antes de actuar. Lee los archivos antes de escribir código.
- Edita solo lo que cambia, no reescribas archivos enteros.
- No releas archivos que ya hayas leído salvo que hayan cambiado.
- No repitas código sin cambios en tus respuestas.
- Sin preámbulos, sin resúmenes al final, sin explicar lo obvio.
- Testea antes de dar por terminado.

---

## 1. Producto y propósito

**Skale Motors v2** — SaaS multi-tenant para concesionarios / venta de autos en Chile.

- Estado: ~80% MVP, en fase de refinamiento (foco reciente: CRM/Leads).
- Cliente final: automotoras con múltiples sucursales, vendedores, financiero, servicio.
- Roles RBAC: `admin`, `gerente`, `jefe_jefe`, `jefe_sucursal`, `vendedor`, `financiero`, `servicio`, `inventario`.
- Idioma del producto: **español (Chile)**. Cualquier copy nuevo va en español.
- Moneda y formatos: CLP, fechas `dd-MM-yyyy`, RUT chileno.

---

## 2. Stack técnico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18.3 + TypeScript 5.8 + Vite 5.4 |
| UI | Tailwind 3.4 + shadcn/ui (Radix) + Framer Motion |
| Routing | React Router 6.30 |
| Data | TanStack Query 5.83 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Calendar | React Big Calendar |
| Backend | Supabase (Postgres + Auth + RLS) |
| Edge Functions | 27 funciones Deno en `supabase/functions/` |
| Migraciones | SQL versionadas en `supabase/migrations/` |
| Serverless extra | 2 endpoints Vercel en `api/` |
| Automatización | n8n multi-tenant (workspace por sucursal) |
| IA | OpenAI vía Edge Functions |
| Observabilidad | Sentry 10.45 + Web Vitals |
| CI/CD | GitHub Actions → lint + build + Vitest. Deploy en Vercel. |
| Tests | Vitest + Testing Library + jsdom |

**Tipado**: `tsconfig.app.json` tiene `noImplicitAny: false` y `strictNullChecks: false`. Hay deuda técnica de `any` implícitos — endurecé tipado solo cuando edites el módulo, no como cleanup masivo.

---

## 3. Estructura de carpetas

```
src/
├── pages/                    # 60+ páginas (rutas top-level)
│   └── studio-ia/           # 17 generadores IA
├── components/
│   ├── ui/                  # primitives shadcn
│   ├── leads/               # CRM-específicos
│   ├── finance/
│   ├── animate-ui/          # backgrounds y efectos
│   └── *.tsx                # componentes globales (Layout, FloatingChatButton…)
├── lib/
│   ├── services/            # 24 servicios — punto único de acceso a Supabase
│   └── types/database.ts    # tipos generados de la BD
├── hooks/                   # 23 custom hooks (useLeads, useVehicles, useSales…)
├── contexts/                # AuthContext, ThemeContext, DeviceContext, ChatContext, ShortcutsPreferencesContext
└── integrations/supabase/   # cliente supabase

supabase/
├── functions/               # 27 Edge Functions Deno
└── migrations/              # 80+ SQL migrations (timestamped)

api/                          # endpoints Vercel (n8n-lead-ingest, chileautos-scrape)
services/autofact-scraper/    # microservicio Python (scraper aparte, con Dockerfile)
scripts/                      # provisioning, tenant setup, SQL utils, JS utils
docs/ + docs/guides/          # arquitectura, seguridad, integraciones, runbooks
```

**Páginas grandes (no fragmentar sin pedido explícito)**: `Finance.tsx` (~148KB), `Inventory.tsx` (~124KB), `Dashboard.tsx` (~89KB), `CRM.tsx`.

---

## 4. Módulos funcionales

| Módulo | Estado | Archivos clave |
|--------|--------|----------------|
| Auth + RBAC + multi-tenancy | ✅ RLS activo en todas las tablas | `AuthContext.tsx`, migraciones `*_multitenant_*.sql` |
| Dashboard + KPIs | ✅ (faltan 4 alertas, ver §9) | `Dashboard.tsx`, `useDashboardStats.ts` |
| CRM / Leads | ✅ tabla + Kanban + ingesta WhatsApp/n8n | `CRM.tsx`, `Leads.tsx`, `LeadsBoard.tsx`, `services/leads.ts` |
| Inventario + Consignaciones | ✅ | `Inventory.tsx`, `Consignaciones.tsx`, `services/vehicles.ts` |
| Citas + Google Calendar (sync bidi) | ✅ | `Appointments.tsx`, `services/appointments.ts` |
| Ventas + comisiones + ranking | ✅ | `SalesManagement.tsx`, `SalespersonRanking.tsx`, `services/sales.ts` |
| Finanzas (gastos, ingresos, salarios, cierre mensual) | ✅ | `Finance.tsx`, `FundManagement.tsx`, `SalaryDistribution.tsx` |
| Studio IA (17 generadores) | ✅ | `pages/studio-ia/*`, Edge Fn `studio-ia-generate` |
| Tasación de vehículos | ✅ vía GetAPI | `VehicleAppraisal.tsx`, Edge Fn `getapi-appraisal` |
| Tareas pendientes | ⚠️ backend OK, falta UI consolidada | `usePendingTasks.ts`, Edge Fn `pending-task-create` |
| Billing (SimpleFACTURA) | ⚠️ backend OK, UI mínima | `Billing.tsx` |
| Pasarelas pago / firma digital | ❌ no implementado | — |

---

## 5. Integraciones externas

- **Google Calendar** (OAuth, sync bidi citas)
- **WhatsApp Business / Meta** (webhook → leads, envío vía Edge Fn `whatsapp-send`)
- **Meta Ads** (campañas, insights — Edge Fns `meta-ads-*`)
- **Marketplaces**: Mercado Libre, Facebook Marketplace, Chile Autos (scraper)
- **SimpleFACTURA** (facturación electrónica Chile)
- **GetAPI** (tasación)
- **n8n** workspace por sucursal (webhooks lead ingest, state updates, recordatorios)

Documentación detallada por integración en `docs/guides/` y `docs/`.

---

## 6. Comandos

```bash
npm run dev              # Vite dev server
npm run build            # build producción
npm run build:dev        # build modo dev
npm run lint             # eslint en src/
npm run test             # vitest run (one-shot)
npm run test:watch       # vitest watch
npm run preview          # preview del build

npm run create:user           # scripts/create_user.mjs
npm run provision:tenant      # scripts/provision_tenant.mjs
npm run lead-ingest:key       # scripts/generate_lead_ingest_key.mjs
```

ESLint solo lintea `src/**/*.{ts,tsx}` — `services/`, `supabase/`, `api/` están ignorados.

---

## 7. Convenciones de código

**Reglas duras**:
- Toda llamada a Supabase pasa por un servicio en `src/lib/services/`. **No usar `supabase.from(...)` desde componentes.**
- Toda lógica de fetch/cache reactiva en hooks (`src/hooks/`) usando React Query.
- Forms con React Hook Form + Zod. No validar a mano.
- UI con shadcn/ui primitives (`components/ui/`) + Tailwind. No CSS modules ni styled-components.
- Iconos con `lucide-react`.
- Notificaciones con `sonner` (toast).
- Fechas con `date-fns`, no Moment.

**Estilo**:
- Comentarios solo cuando el *por qué* no es obvio. Nunca describir el *qué* del código.
- Componentes funcionales con TypeScript. Props tipadas con `interface` o `type` local.
- Nombres en inglés para código, español solo para copy de UI.
- No introducir abstracciones especulativas. 3 líneas similares < abstracción prematura.

**Prohibido sin pedido explícito**:
- Crear archivos `.md` nuevos.
- Refactor masivo o cleanup mientras se hace un fix.
- Backwards-compat shims, feature flags innecesarios.
- Cambiar el tipado global del proyecto (endurecer `tsconfig`).
- Fragmentar páginas grandes (Finance, Inventory, Dashboard).

---

## 8. Multi-tenancy y seguridad

**Crítico**: este SaaS es multi-tenant con aislamiento por **RLS**. Toda tabla nueva o consulta debe respetarlo.

- Cada tabla tiene `tenant_id` (y muchas también `branch_id`).
- Las policies RLS están en migraciones — buscalas con `grep -r "POLICY" supabase/migrations/` antes de tocar permisos.
- `auth.app_metadata.role` y `tenant_id` se sincronizan con triggers (ver `*_sync_role_to_auth_app_metadata.sql`).
- Edge Functions: validar tenant del usuario contra el recurso accedido. **Nunca confiar en input del cliente para `tenant_id`**.
- Secrets en Supabase Secrets (`OPENAI_API_KEY`, etc.), no en repo.
- Lead ingest usa keys rotables (`lead_ingest_keys` table + RPCs).

Si vas a tocar RLS, leé primero `docs/guides/SEGURIDAD.md` y `docs/guides/MIGRACION_PRODUCCION.md`.

---

## 9. Gaps conocidos (snapshot — re-verificar antes de afirmar)

- 4 TODOs en `Dashboard.tsx` (~líneas 302–349): alertas tarea/lead/cita/email sin integrar.
- `pending_tasks`: backend listo, UI dashboard pendiente. Plan en `docs/PLAN_TAREAS_PENDIENTES_LLM.md`.
- `Billing.tsx` es stub (~2KB) aunque SimpleFACTURA está integrada en backend.
- MFA TOTP documentado, no implementado en UI.
- Pasarelas de pago (Stripe / MercadoPago) — no existen.
- Firma digital de contratos — no existe.
- Tests propios: solo `rbac.test.ts`, `tenant.test.ts`, `authAppOrigin.test.ts`. Cobertura baja, cero E2E.
- Vite warning: chunk >600KB.

**Antes de afirmar que algo sigue pendiente, verificá con grep/read** — esta lista decae rápido.

---

## 10. Workflow de desarrollo

> Toda feature, fix o refactor pasa por un **worktree dedicado** + un **PR (draft desde el inicio)**. No se trabaja sobre `main` directo.

### 10.1 Worktrees

- Cada tarea no trivial = un worktree propio en `../skalemotors_v2-<nombre-corto>` (afuera del repo principal, mismo nivel).
- Bootstrap: `bash scripts/new-worktree.sh <nombre-corto> <branch-name>` — crea el worktree, copia `.env`, instala deps.
- Cleanup: `bash scripts/cleanup-worktree.sh <nombre-corto>` cuando el PR ya está mergeado.
- El worktree principal queda siempre en `main` y limpio.
- Listar worktrees vivos: `git worktree list`.

### 10.2 Naming de branches

| Prefijo | Para qué |
|---------|----------|
| `feat/` | Feature nueva |
| `fix/` | Bugfix |
| `refactor/` | Reestructurar sin cambiar comportamiento |
| `chore/` | Tooling, configs, deps, scripts |
| `docs/` | Solo documentación |
| `test/` | Solo tests |
| `perf/` | Performance |
| `security/` | Hardening, RLS, auth, secrets |
| `style/` | Formato (prettier, eslint --fix) |

Ejemplos: `feat/lead-vehicle-matching`, `fix/dashboard-alerts`, `security/rls-tests`.

### 10.3 Pull Requests

**Regla de oro**: abrir el PR en modo **draft** después del **primer commit**, no al final. El draft acumula contexto durante el desarrollo.

```bash
# Después del primer commit del branch:
gh pr create --draft --title "<tipo>(<scope>): <resumen>"
# (GitHub usa automáticamente .github/pull_request_template.md)

# Cuando esté listo:
gh pr ready

# Merge (solo cuando el usuario lo pida explícito):
gh pr merge --squash --delete-branch
```

**Plantilla obligatoria** (vive en `.github/pull_request_template.md`): Objetivo, Cambios, Decisiones, Asunciones, Pendientes/follow-ups, Cómo probar, Refs.

**Tamaño de PR**: máximo **~300 líneas de diff**. Si pasa, partir en PRs encadenados (`feat/x-1`, `feat/x-2`, …) con dependencia explícita en la descripción. PRs gigantes no se revisan — se aprueban a ciegas.

### 10.4 Lectura de contexto antes de codear

Todo agente (humano o IA) que arranque sobre este repo lee **primero**:

```bash
gh pr list --state merged --limit 10     # qué se mergeó recientemente
gh pr list --state open                  # qué hay en vuelo
gh issue list --state open --limit 20    # issues abiertos
git log --oneline -20                    # commits recientes en main
git worktree list                        # worktrees vivos
```

Usar la salida como input al planificar la tarea.

### 10.5 Reglas heredadas del régimen anterior

1. **Leer antes de escribir**. Identificá el servicio + hook + componente involucrados.
2. **Cambios chicos y atómicos**. Un fix por commit.
3. **Migraciones SQL**: nuevo archivo en `supabase/migrations/` con timestamp `YYYYMMDDHHMMSS_descripcion.sql`. Nunca editar migraciones aplicadas.
4. **Tipos de BD**: si tocás schema, regenerá `src/lib/types/database.ts` (vía MCP Supabase `generate_typescript_types` o CLI).
5. **Tests**: si el módulo tiene tests, mantenerlos verdes. Nuevos features de seguridad/RBAC → test obligatorio.
6. **Validar antes de marcar `gh pr ready`**: `npm run lint && npm run build && npm run test`.
7. **UI**: para cambios visuales, abrir `npm run dev` y probar el flow real en browser. Type-check ≠ feature-check.

**Commits**: conventional commits preferido (`feat(scope):`, `fix(scope):`). Idioma español. Co-author Claude solo si el usuario lo pide explícito.

**Merge a `main`** solo cuando el usuario lo pida explícito. Nunca `--no-verify` ni force-push.

Para detalles humanos del workflow ver también `CONTRIBUTING.md`. Para operación (deploy/rollback) ver `docs/runbook.md`.

---

## 11. Memoria del proyecto

Hay memorias persistentes en `.claude/memory/MEMORY.md` (overview, tech_stack, pending_work). Esas memorias **decaen** — re-verificá contra el código antes de afirmarlas como hechos actuales. Este `CLAUDE.md` es la fuente más confiable que las memorias.

---

## 12. Fuera de alcance / no tocar

- `services/autofact-scraper/` — microservicio Python aislado, deploy separado.
- `dist/` — build artifacts, generado.
- `bun.lockb` — lockfile (el repo usa `npm`, pero hay lockfile de bun residual).
- Archivos `.lovable*` o `lovable-tagger` — herramienta externa, no modificar su comportamiento.

---

**Cuando dudes, preguntá antes de actuar.** El costo de confirmar es bajo; el costo de un cambio masivo no pedido es alto.
