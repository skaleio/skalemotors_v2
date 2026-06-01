# Diseño: Seguridad robusta Skale Motors (producción)

**Fecha:** 2026-06-01  
**Estado:** Implementado en repo (2026-06-01). Pendiente: `db push` + secrets Vercel/Supabase.  
**Alcance:** Postura de seguridad SaaS multi-tenant (React + Supabase + Vercel)

---

## Objetivo

Que ningún actor no autorizado acceda a datos de otro tenant ni abuse de APIs (IA, ingesta de leads, auth), con defensa en profundidad alineada al stack actual — **sin** depender de ocultar la clave publishable de Supabase en DevTools.

## Principio rector

| Visible en el navegador | Rol de seguridad |
|-------------------------|------------------|
| `VITE_SUPABASE_ANON_KEY` (`apikey`) | Identificador público del proyecto; **no** otorga acceso a datos sin JWT + RLS |
| `Authorization: Bearer <JWT>` | Sesión del usuario; proteger contra robo (XSS, MFA, sesiones) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Nunca** en frontend; solo Edge Functions / Vercel serverless |

## Enfoque elegido: RLS-first + hardening operativo (Enfoque A)

Mantener SPA → Supabase directo. Seguridad real en:

1. **RLS** por `tenant_id` / `branch_id` en todas las tablas de negocio.
2. **Edge Functions** con `requireAuth`, cuotas IA, webhooks firmados.
3. **APIs Vercel** con keys por branch (`lead_ingest_keys`), sin env-key global en producción.
4. **MFA** obligatorio para roles privilegiados cuando el flag de producción está activo.
5. **Operación:** Dashboard Supabase (pwned passwords, CORS secrets), checklist manual.

**Descartado como prioridad:** BFF completo solo para esconder headers en Network (costo alto, beneficio marginal si RLS está correcto).

## Modelo de amenazas (resumen)

- **T1 — Cross-tenant read/write:** mitigado por RLS restrictivo + fix admin IA (migración `20260827120000_risk_mitigation_pack.sql`).
- **T2 — Cost amplification (OpenAI/Anthropic):** mitigado por `requireAuth` en `studio-ia-generate` y `ai-generate` + `tenant_ai_quotas`.
- **T3 — Signup no provisionado:** mitigado eliminando insert manual en `AuthContext.signUp`.
- **T4 — Lead injection global:** mitigado gate `isProductionEnv()` en `api/n8n-lead-ingest.ts`.
- **T5 — Cuenta admin comprometida:** mitigado MFA TOTP (UI + `VITE_MFA_GATE_ENABLED` / `VITE_FLAG_INVESTOR_READY_SECURITY`).
- **T6 — Catálogo `expense_types` abierto:** mitigado migración `20260601143000_security_production_ready_pack.sql` (RLS + SELECT authenticated).

## Componentes

### Base de datos

- Policies permisivas + **RESTRICTIVE** `tenant_restrict_*` en tablas multi-tenant.
- RPCs sensibles: `REVOKE EXECUTE` desde `authenticated` donde solo deben correr por trigger.
- `expense_types`: catálogo global, SELECT para authenticated; mutaciones solo `admin` / `jefe_jefe`.

### Edge Functions

- Auth en código vía `_shared/authGuard.ts` (JWT ES256: `verify_jwt` puede estar en `false` en gateway; validación en handler).
- Webhook studio IA: header `x-studio-ia-secret` vs `STUDIO_IA_WEBHOOK_SECRET`.
- CORS: secret `ALLOWED_ORIGINS` (comma-separated).

### Frontend

- Cliente: solo `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- MFA: `useMfaGate` en `ProtectedRoute`, enroll en Settings, verify en `/login/mfa`.
- Flags: `VITE_MFA_GATE_ENABLED`, `VITE_MFA_ENROLLMENT_MANDATORY`, o kill-switch global `VITE_FLAG_INVESTOR_READY_SECURITY=true`.

### Vercel / API

- Headers CSP/HSTS en `vercel.json`.
- Lead ingest: `LEAD_INGEST_ALLOWED_ORIGINS` en producción.

## Fases

### Fase 0 — Bloqueadores (código + migraciones en repo)

| ID | Item | Estado en repo |
|----|------|----------------|
| C1 | Admin IA acotado por tenant | ✅ `20260827120000_risk_mitigation_pack.sql` |
| C2/C3 | Edge IA con auth + cuotas | ✅ `requireAuth` + `aiQuotaGuard` |
| C4 | Sin signup fallback manual | ✅ `AuthContext.tsx` |
| C5 | Env lead key solo no-prod | ✅ `n8n-lead-ingest.ts` |
| C6 | MFA UI + policy por env | ✅ esta entrega (`mfaPolicy.ts` + flags) |
| C7 | RLS `expense_types` | ✅ `20260601143000_security_production_ready_pack.sql` |

### Fase 1 — Activación en producción (manual)

Ver `docs/security/PRODUCTION_READY_CHECKLIST.md`.

### Fase 2 — Continuo

- `/audit-full` periódico, `npm audit`, pentest externo, rotación `lead_ingest_keys`.

## Criterios de éxito

1. Usuario tenant A no ve filas de tenant B (prueba con dos cuentas).
2. POST anónimo a `studio-ia-generate` / `ai-generate` → 401.
3. `N8N_LEAD_INGEST_API_KEY` rechazada en `VERCEL_ENV=production`.
4. Admin/gerente/jefe_jefe sin TOTP no accede a `/app/*` cuando MFA gate activo.
5. `expense_types`: authenticated puede SELECT; vendedor no INSERT.

## Referencias

- `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md`
- `docs/security/TOGGLES_MANUALES.md`
- `docs/guides/SEGURIDAD.md`
- `.cursor/rules/multi-tenant-isolation.mdc`
