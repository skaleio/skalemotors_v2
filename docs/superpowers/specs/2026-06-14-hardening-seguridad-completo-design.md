# Hardening de seguridad completo — Skale Motors v2

**Fecha:** 2026-06-14
**Alcance:** Cerrar todo lo que marca el advisor en vivo (proyecto productivo correcto), añadir rate/batch limits en todos los ingress públicos/anon, auditar funciones sensibles y reducir superficie de DoS. Objetivo del founder: *"todo listo contra cualquier ataque"*.
**Ejecución:** PR-first (worktree + migraciones + Edge Functions → PR draft → merge humano). Toggles de Dashboard los aplica el founder con instrucciones.

---

## Contexto y línea base

La auditoría `AUDITORIA_SEGURIDAD_PRE_MVP.md` (2026-05-05) corrió contra el proyecto **equivocado** (Nomadev). Este spec se basa en el **advisor en vivo del proyecto Skale correcto** (`get_advisors`, 2026-06-14).

**Ya resuelto (no se toca):** RLS cubre casi todas las tablas; `studio-ia-generate` y `ai-generate` con `verify_jwt:true`; `meta-webhook` con HMAC; `chileautos-proxy` con SSRF guard; CSP/HSTS/COOP fuertes en `vercel.json`; passwords con bcrypt nativo.

**Drift detectado:** el repo tiene migraciones `20260828*`/`20260829*` (re-fixes de advisor) **no aplicadas** en prod (lo aplicado llega a `20260614`). Se reconcilia: las migraciones nuevas de este spec se escriben con timestamp posterior y son idempotentes (`DROP ... IF EXISTS`, `CREATE OR REPLACE`).

---

## Hallazgos abiertos (advisor en vivo)

### Seguridad
1. **10 funciones SECURITY DEFINER ejecutables por `anon`.** 3 intencionales (booking público Fórmula Miami: `formula_book_appointment`, `formula_cancel_appointment`, `formula_get_available_slots`). Las otras 7 NO deben ser anon:
   - Triggers (no deben exponerse como RPC): `archive_lead_note_change`, `enforce_lead_note_vendor_source`, `sync_seller_inactivity_notifications` → `service_role` only.
   - Helper RLS: `current_user_branch_id` → `authenticated` only.
   - Ops de vendedor (validan internamente pero no deben ser anon): `get_seller_engagement_metrics`, `update_branch_sales_staff_profile`, `upsert_seller_app_presence` → `authenticated` (+`service_role` donde aplique).
2. **3 funciones con `search_path` mutable:** `vehicles_clear_publicado_web_on_terminal_status`, `vehicle_status_display_label`, `lead_source_display_label` → `SET search_path = public, pg_temp`.
3. **2 tablas RLS-on sin policy:** `formula_availability_rules` (añadir policy: SELECT anon para slots + escritura formula CRM); `whatsapp_inbox_credentials` (confirmar service-role-only con policy restrictiva explícita + comentario).
4. **Pwned password protection OFF** (HIBP) → toggle Dashboard.
5. **41 funciones SECURITY DEFINER ejecutables por `authenticated`** — mayoría by-design. Auditar (read-only) las 6 sensibles: `export_tenant_data_bundle`, `provision_tenant`, `super_admin_ai_cost_summary`, `dispatch_webhook`, `invite_team_member`, `complete_tenant_onboarding`. Si alguna no valida rol/tenant internamente → endurecer.

### Rate / batch limits (pedido explícito)
6. Hoy solo IA (`aiQuotaGuard`), `vehicle-appraisal/lookup`, `chileautos-scrape` tienen rate-limit. **Faltan** en ingress público/anon:
   - Edge Functions: `vitrina-lead`, `landing-booking`, `getapi-appraisal`, `lead-create`, `lead-state-update`.
   - RPC anon: `formula_book_appointment`, `formula_get_available_slots`.

### Performance con impacto DoS
7. 23 `auth_rls_initplan` (envolver `auth.uid()` → `(select auth.uid())`), 9 `multiple_permissive_policies` (consolidar), 22 `unindexed_foreign_keys` (índices). 75 `unused_index` → **no** se tocan (riesgo > beneficio, fuera de alcance de seguridad).

---

## Arquitectura de la solución

### Componente A — Migración: lockdown de funciones (`*_lockdown_security_definer_grants.sql`)
- `REVOKE ALL ... FROM PUBLIC, anon` en las 7 funciones no-públicas; `GRANT EXECUTE TO authenticated`/`service_role` según rol.
- `ALTER FUNCTION ... SET search_path = public, pg_temp` en las 3 mutables.
- Idempotente. Sin `CREATE OR REPLACE` de cuerpos (solo grants/search_path) para minimizar riesgo.

### Componente B — Migración: RLS de las 2 tablas (`*_rls_formula_availability_whatsapp_creds.sql`)
- `formula_availability_rules`: policy SELECT para `anon` (slots públicos) + ALL para formula CRM (`user_can_access_formula_crm()`).
- `whatsapp_inbox_credentials`: policy restrictiva explícita (solo `service_role`), comentario documentando el diseño.

### Componente C — Rate limiting unificado
- **DB:** tabla `edge_rate_limits (identifier text, route text, window_start timestamptz, count int, PRIMARY KEY(identifier, route, window_start))` + función `check_rate_limit(p_identifier, p_route, p_max, p_window_seconds) RETURNS boolean` (SECURITY DEFINER, service_role only). Ventana fija (fixed-window). Limpieza vía borrado de ventanas viejas en la misma función.
- **Edge:** helper `_shared/rateLimit.ts` que llama `check_rate_limit` vía service_role, deriva `identifier` de IP (`x-forwarded-for`) o `auth.uid()`, devuelve `429` con `Retry-After` si excede. **Batch limit:** validar tamaño de body / cantidad de items por request (límite configurable por ruta) antes de procesar.
- Aplicar a: `vitrina-lead`, `landing-booking`, `getapi-appraisal`, `lead-create`, `lead-state-update`.
- **RPC anon de booking:** rate-limit dentro del RPC (`formula_book_appointment`) usando la misma tabla, keyed por email/teléfono+IP.

### Componente D — Migración: performance/DoS (`*_perf_rls_initplan_fk_indexes.sql`)
- Reescribir las 23 policies con `auth.<fn>()` → `(select auth.<fn>())`.
- Consolidar las 9 permisivas duplicadas (merge por tabla/rol/acción).
- `CREATE INDEX CONCURRENTLY IF NOT EXISTS` para los 22 FKs sin índice. (Nota: `CONCURRENTLY` no corre en transacción — migración separada o sin `CONCURRENTLY` si el runner lo exige.)

### Componente E — Auditoría read-only de las 6 funciones sensibles
- Leer cuerpos vía `pg_get_functiondef`. Documentar en el PR si validan rol/tenant. Endurecer solo si hay hueco real.

### Componente F — Instrucciones Dashboard (entregable, no código)
- HIBP pwned-password ON; MFA TOTP enable; confirmar Edge secrets (`ALLOWED_ORIGINS`, `STUDIO_IA_WEBHOOK_SECRET`); advisors sin ERROR.

---

## Validación
- Re-correr `get_advisors` (security + performance) tras aplicar → confirmar reducción de WARN.
- `npm run lint && npm run build` antes de `gh pr ready`.
- Smoke (manual/checklist): RPC anon de booking spameado → `429`; `vitrina-lead` > N/min → `429`; función trigger ya no llamable por anon vía `/rest/v1/rpc`.

## Orden de ejecución (riesgo ascendente)
1. Componente A (grants/search_path) — bajo riesgo.
2. Componente B (RLS 2 tablas) — bajo.
3. Componente E (audit read-only) — nulo.
4. Componente C (rate/batch limits) — medio.
5. Componente D (perf RLS/índices) — medio (índices son aditivos; reescritura de policies requiere cuidado).
6. Componente F (Dashboard) — manual founder.

## Fuera de alcance
- Drop de 75 índices no usados.
- Cifrado pgcrypto de `marketplace_connections`/`meta_ads` (H9 histórico) — post-MVP, ya documentado en checklist.
- Pentest externo.
