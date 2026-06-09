# CLAUDE.md — Skale Motors v2

## Tokens
- Lee antes de escribir. Edita solo lo que cambia. No releas sin cambio. No repitas código.
- Sin preámbulos, sin resúmenes al final. Testea antes de declarar terminado.

## Producto
SaaS multi-tenant concesionarios Chile. ~80% MVP, foco actual: CRM/Leads.
Roles: `admin` `gerente` `jefe_jefe` `jefe_sucursal` `vendedor` `financiero` `servicio` `inventario`
Copy en español (Chile). Moneda: CLP. Fechas: `dd-MM-yyyy`. RUT chileno.

## Stack
React 18.3+TS 5.8+Vite 5.4 · Tailwind 3.4+shadcn/ui+Framer Motion · React Router 6.30
TanStack Query 5.83 · React Hook Form+Zod · Recharts · React Big Calendar
Supabase (Postgres+Auth+RLS) · 27 Edge Functions Deno · 2 endpoints Vercel `api/`
n8n multi-tenant · OpenAI vía Edge Fns · Sentry 10.45 · GitHub Actions→Vercel
`tsconfig.app.json`: `noImplicitAny:false`, `strictNullChecks:false` — endurecer solo al editar el módulo.

## Estructura
```
src/pages/          # 60+ páginas; studio-ia/ = 17 generadores IA
src/components/     # ui/ primitives, leads/, finance/, animate-ui/, globals
src/lib/services/   # 24 servicios — único punto de acceso a Supabase
src/lib/types/database.ts
src/hooks/          # 23 hooks (useLeads, useVehicles, useSales…)
src/contexts/       # AuthContext ThemeContext DeviceContext ChatContext ShortcutsPreferencesContext
src/integrations/supabase/
supabase/functions/ # 27 Edge Functions
supabase/migrations/# 80+ SQL timestamped
api/                # n8n-lead-ingest, chileautos-scrape
scripts/            # provisioning, tenant setup, SQL/JS utils
```
**No fragmentar sin pedido:** `Finance.tsx`(~148KB) `Inventory.tsx`(~124KB) `Dashboard.tsx`(~89KB) `CRM.tsx`

## Módulos
| Módulo | Estado | Archivos clave |
|--------|--------|----------------|
| Auth+RBAC+multi-tenancy | ✅ | `AuthContext.tsx`, `*_multitenant_*.sql` |
| Dashboard+KPIs | ✅ (4 alertas faltantes §gaps) | `Dashboard.tsx`, `useDashboardStats.ts` |
| CRM/Leads | ✅ Kanban+WhatsApp/n8n | `CRM.tsx`, `LeadsBoard.tsx`, `services/leads.ts` |
| Inventario+Consignaciones | ✅ | `Inventory.tsx`, `services/vehicles.ts` |
| Citas+Google Calendar bidi | ✅ | `Appointments.tsx`, `services/appointments.ts` |
| Ventas+comisiones+ranking | ✅ | `SalesManagement.tsx`, `services/sales.ts` |
| Finanzas | ✅ | `Finance.tsx`, `FundManagement.tsx`, `SalaryDistribution.tsx` |
| Studio IA | ✅ | `pages/studio-ia/*`, Edge Fn `studio-ia-generate` |
| Tasación | ✅ GetAPI | `VehicleAppraisal.tsx`, Edge Fn `getapi-appraisal` |
| Tareas pendientes | ⚠️ backend OK, falta UI | `usePendingTasks.ts`, Edge Fn `pending-task-create` |
| Billing (SimpleFACTURA) | ⚠️ backend OK, UI stub | `Billing.tsx` |
| Pasarelas pago / firma digital | ❌ | — |

## Integraciones externas
Google Calendar (OAuth bidi) · WhatsApp Business/Meta (webhook→leads, `whatsapp-send`) · Meta Ads (`meta-ads-*`) · Mercado Libre · Facebook Marketplace · Chile Autos (scraper) · SimpleFACTURA · GetAPI · n8n por sucursal

## Comandos
```bash
npm run dev / build / build:dev / lint / test / test:watch / preview
npm run create:user / provision:tenant / lead-ingest:key
```
ESLint solo en `src/` — `services/` `supabase/` `api/` ignorados.

## Convenciones (reglas duras)
- Supabase solo desde `src/lib/services/`. Nunca `supabase.from(...)` en componentes.
- Fetch/cache en hooks con React Query. Forms con RHF+Zod. UI con shadcn+Tailwind.
- Iconos: `lucide-react`. Toasts: `sonner`. Fechas: `date-fns`.
- Nombres en inglés (código), español (copy UI).
- Sin abstracciones especulativas.

**Prohibido sin pedido explícito:** crear `.md`, refactor masivo en un fix, backwards-compat shims, cambiar `tsconfig` global, fragmentar páginas grandes.

## Multi-tenancy y seguridad
Multi-tenant por RLS — toda tabla tiene `tenant_id` (muchas también `branch_id`).
- RLS policies en migraciones: `grep -r "POLICY" supabase/migrations/`
- `auth.app_metadata.role` + `tenant_id` sincronizados con triggers (`*_sync_role_to_auth_app_metadata.sql`)
- Edge Functions: validar tenant del usuario vs recurso. **Nunca confiar en `tenant_id` del cliente.**
- Secrets en Supabase Secrets, no en repo. Lead ingest keys en `lead_ingest_keys` + RPCs.
- Antes de tocar RLS: leer `docs/guides/SEGURIDAD.md` y `docs/guides/MIGRACION_PRODUCCION.md`.

## Gaps conocidos (re-verificar antes de afirmar)
- `Dashboard.tsx` ~líneas 302–349: 4 alertas tarea/lead/cita/email sin integrar.
- `pending_tasks`: UI dashboard pendiente. Plan: `docs/PLAN_TAREAS_PENDIENTES_LLM.md`.
- `Billing.tsx` stub (~2KB), SimpleFACTURA integrada en backend.
- MFA TOTP documentado, no en UI. Pasarelas pago/firma digital: no existen.
- Tests: solo `rbac.test.ts`, `tenant.test.ts`, `authAppOrigin.test.ts`. Cero E2E.
- Vite warning: chunk >600KB.

## Workflow

**Regla:** toda feature/fix/refactor en worktree dedicado + PR draft desde el primer commit. No tocar `main` directo.

**Worktrees:** `../skalemotors_v2-<nombre>` · bootstrap: `bash scripts/new-worktree.sh <nombre> <branch>` · cleanup: `bash scripts/cleanup-worktree.sh <nombre>` · listar: `git worktree list`

**Branches:** `feat/` `fix/` `refactor/` `chore/` `docs/` `test/` `perf/` `security/` `style/`

**PRs:** draft tras primer commit → `gh pr create --draft` → `gh pr ready` cuando listo → `gh pr merge --squash --delete-branch` solo si el usuario lo pide.
Máximo ~300 líneas de diff. Si pasa: partir en PRs encadenados.
Validar: `npm run lint && npm run build && npm run test` antes de `gh pr ready`.

**Migraciones SQL:** nuevo archivo `supabase/migrations/YYYYMMDDHHMMSS_descripcion.sql`. Nunca editar migraciones aplicadas.
**Tipos BD:** si tocás schema → `generate_typescript_types` vía MCP o CLI.
**Commits:** conventional commits en español. Co-author Claude solo si el usuario lo pide.

**Contexto al arrancar:**
```bash
gh pr list --state merged --limit 10
gh pr list --state open
git log --oneline -20
git worktree list
```

## Fuera de alcance
`services/autofact-scraper/` · `dist/` · `bun.lockb` · `.lovable*` / `lovable-tagger`

## Security Auditor (`security-auditor` sub-agente, read-only)
| Comando | Uso |
|---------|-----|
| `/audit-fixes` | Validar 41 hallazgos pre-MVP |
| `/audit-full [--scope=X] [--save]` | Auditoría 8 dominios; `--save` → `docs/security/audit-<fecha>.md` |
| `/audit-diff [PR#\|branch]` | Revisión rápida del diff antes de `gh pr ready` o merge |

Reglas: nunca modifica código ni corre SQL mutante. Enmascara secrets. Toda finding cita `archivo:línea`.
Trigger sugerido al editar: `supabase/migrations/` `supabase/functions/` `AuthContext.tsx` `src/lib/services/` `api/*.ts` `package.json`
