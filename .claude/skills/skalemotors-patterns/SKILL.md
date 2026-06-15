---
name: skalemotors-patterns
description: Patrones de código y workflow extraídos del historial git de Skale Motors v2 (SaaS multi-tenant concesionarios Chile). Úsalo al implementar features/fixes en CRM, Leads, Citas o al tocar servicios Supabase, migraciones y deploy a Vercel.
version: 1.0.0
source: local-git-analysis
analyzed_commits: 200
---

# Skale Motors v2 — Patrones del repositorio

Patrones reales detectados en los últimos ~200 commits. Complementan `CLAUDE.md`; no lo reemplazan.

## Convenciones de commit

Convención canónica: **conventional commits en español**.

```
tipo(scope): descripción en minúscula
```

- Tipos observados (frecuencia): `fix` (56), `feat` (23), `refactor` (8), `security` (4), `chore` (4), `docs` (3), `perf` (1).
- Scopes reales: `crm`, `leads`, `citas`, `deploy`, `theme`, `tasks`, `auth`, `dashboard`. Ej: `feat(crm): separar notas n8n y vendedor`, `fix(citas): evitar crash del calendario para vendedores en produccion`, `fix(deploy): mover helpers api/lib a api/_lib para limite Hobby`.
- **Anti-patrón presente en la historia, NO imitar:** commits informales tipo `fix crm miercoles lets go`, `FIX: NOTAS CRM`, `viernes out`, `fic: ...`. Existen pero degradan la trazabilidad. Escribir siempre `tipo(scope): qué cambió`.

## Foco activo (por qué cambia cada archivo)

Los archivos más tocados marcan dónde vive el trabajo real:

| Archivo | Cambios | Significado |
|---------|---------|-------------|
| `src/pages/CRM.tsx` | 49 | Módulo en evolución constante — Kanban, notas, contact_state, visibilidad por rol |
| `src/lib/types/database.ts` | 34 | Schema churn: cada cambio de tabla regenera tipos |
| `src/pages/Leads.tsx` | 32 | Embudo, urgencia, asignación |
| `src/components/AppSidebar.tsx` | 29 | Navegación por rol |
| `src/contexts/AuthContext.tsx` | 23 | Núcleo RBAC/sesión — tocar con cuidado |
| `api/n8n-lead-ingest.ts` | 19 | Ingesta de leads desde n8n |

**Implicación:** CRM/Leads/Citas es el área caliente. Cambios ahí suelen arrastrar `database.ts` (tipos) + una migración + un servicio + un test de lógica.

## Arquitectura de código

```
src/lib/services/   # ÚNICO acceso a Supabase. Nunca supabase.from() en componentes/páginas
src/hooks/          # React Query: fetch/cache. Envuelven services
src/lib/*.ts        # Lógica pura testeable (crmPipeline, leadContactState, appointmentWrite…)
src/pages/          # Páginas grandes (CRM, Finance, Inventory) — no fragmentar sin pedido
supabase/migrations/# YYYYMMDDHHMMSS_descripcion.sql, nunca editar aplicadas
api/                # Endpoints Vercel. Helpers compartidos en api/_lib (no api/lib)
```

## Patrón de testing (corrige el gap de CLAUDE.md)

**CLAUDE.md dice "solo 3 tests" — desactualizado.** Hay ~30 suites. El patrón real:

> La lógica de negocio se **extrae a un módulo puro** `src/lib/<concepto>.ts` y se testea aislada en `src/lib/<concepto>.test.ts`. No se testean componentes ni se hace E2E.

Ejemplos: `leadContactState.test.ts`, `appointmentWrite.test.ts`, `crmPipeline.test.ts`, `leadsScope.test.ts`, `mfaPolicy.test.ts`, `pendingTaskDedupe.test.ts`, `appRoles.test.ts`.

**Al implementar una regla de negocio nueva** (visibilidad por rol, transición de estado, deduplicación, scope de query): extraela a una función pura en `src/lib/` y escribí su `.test.ts` antes/junto a la integración en la página. Corré `npm run test`.

## Workflows recurrentes

### Cambio que toca el schema
1. Nueva migración `supabase/migrations/YYYYMMDDHHMMSS_descripcion.sql` (incluir RLS si aplica).
2. Regenerar tipos → `src/lib/types/database.ts` (MCP `generate_typescript_types` o CLI).
3. Actualizar el service en `src/lib/services/`.
4. Extraer lógica pura + test si hay reglas (estados, visibilidad).
5. Consumir vía hook con React Query en la página.

### Reglas de visibilidad/RLS por rol (patrón CRM/Citas muy frecuente)
- Migración con `POLICY` por rol (`jefe_sucursal`, `vendedor`, `jefe_jefe`…).
- Lógica espejo en `src/lib/*Scope.ts` + test (`leadsScope`, `appointmentCalendarScope`).
- Confiar en `auth.app_metadata`, nunca en `tenant_id` del cliente.

### Deploy a Vercel (Hobby) — restricciones aprendidas a golpes
- **Límite de 12 Serverless Functions.** Commits reales: quitar `vitrina/.next`, mover helpers a `api/_lib` para que no cuenten como functions.
- `vite build` NO corre `tsc`: imports faltantes explotan en runtime como `ReferenceError`. Verificar imports manualmente; el build verde no garantiza tipos.
- Narrowing de TS en `api/` rompe el build de Vercel aunque pase local — revisar tipos en endpoints.

## Reglas duras (de CLAUDE.md, reforzadas por la historia)
- Supabase solo desde `src/lib/services/`.
- Worktree + PR draft por feature/fix; no tocar `main` directo. PRs ≤ ~300 líneas.
- Nunca editar migraciones ya aplicadas.
- `npm run lint && npm run build && npm run test` antes de `gh pr ready`.
- Copy en español (Chile): CLP, fechas `dd-MM-yyyy`, RUT chileno.
