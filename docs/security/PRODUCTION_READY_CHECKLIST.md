# Checklist — Skale Motors production-ready (seguridad completa)

**Última actualización:** 2026-06-01  
**Preflight local:** `node scripts/security-preflight.mjs`

## A. Código en repo (debe estar mergeado)

| ID | Item | Evidencia en repo |
|----|------|-------------------|
| C1 | Admin IA solo en su tenant | `20260827120000_risk_mitigation_pack.sql` |
| C2/C3 | Edge IA con auth + límites payload | `requireAuth`, `payloadLimits.ts` |
| C4 | Signup sin insert manual | `AuthContext.tsx` |
| C5 | Env lead key solo dev | `api/n8n-lead-ingest.ts` |
| C6 | MFA UI + flags env | `mfaPolicy.ts`, `ProtectedRoute` |
| C7 | RLS `expense_types` | `20260601143000_security_production_ready_pack.sql` |
| H2 | Branch filters + tenant | `20260601150000_security_hardening_complete_pack.sql` |
| H3 | WhatsApp inbox tenant | `whatsapp-send/index.ts` |
| H4/H5 | Keys per-branch automatización | `leadIngestAuth.ts`, lead-create, pending-task, lead-state |
| H6 | Idempotency lead updates | `lead-create` + header |
| H7 | Webhook studio firmado | `STUDIO_IA_WEBHOOK_SECRET` |
| H8 | Legacy bypass allowlist | `legacyAccess.ts` |
| H10 | CORS configurable | `ALLOWED_ORIGINS`, `LEAD_INGEST_ALLOWED_ORIGINS` |
| H12 | Signup race | resuelto con C4 |
| H13 | Errores genéricos APIs | n8n-lead-ingest, lead-create |
| H14 | ChileAutos auth + rate limit | `api/chileautos-scrape.ts` |
| M4 | Logout por inactividad | `useSessionInactivity.ts` |
| M11 | robots.txt | `public/robots.txt` |
| M12 | Idempotency n8n ingest | `lead_ingest_idempotency` + API |

## B. Migraciones Supabase (proyecto productivo)

```bash
supabase link --project-ref <SKALE_PROJECT_REF>
supabase db push
```

Incluir al menos:

- `20260827120000_risk_mitigation_pack.sql`
- `20260601143000_security_production_ready_pack.sql`
- `20260601150000_security_hardening_complete_pack.sql`
- `20260601150100_lead_ingest_idempotency.sql`

## C. Vercel — Production

Copiar desde `.env.production.example`:

| Variable | Valor |
|----------|--------|
| `VITE_FLAG_INVESTOR_READY_SECURITY` | `true` |
| `VITE_MFA_GATE_ENABLED` | `true` |
| `VITE_MFA_ENROLLMENT_MANDATORY` | `true` |
| `VITE_SESSION_INACTIVITY_MS` | `1800000` |
| `LEAD_INGEST_ALLOWED_ORIGINS` | dominio n8n |
| `CHILEAUTOS_SCRAPE_API_KEY` | secret largo |
| `N8N_LEAD_INGEST_API_KEY` | **no definir** |

Redeploy tras cambios.

## D. Supabase Dashboard

- [ ] Auth → Pwned password protection ON
- [ ] Edge secrets: `ALLOWED_ORIGINS`, `STUDIO_IA_WEBHOOK_SECRET`, `LEGACY_BYPASS_EMAILS`
- [ ] Advisors sin ERROR críticos en proyecto **Skale** (no otro proyecto)
- [ ] MFA TOTP habilitado

## E. Pruebas de humo (obligatorias)

- [ ] Usuario tenant A no ve datos tenant B
- [ ] Admin sin TOTP → bloqueado en `/app`
- [ ] `curl` Edge `ai-generate` sin JWT → 401
- [ ] Lead ingest env global en prod → 401
- [ ] Repetir POST n8n con mismo `Idempotency-Key` → misma respuesta, sin duplicar lead
- [ ] `GET /api/chileautos-scrape` sin key → 401 en prod

## F. Pendiente post-MVP (no bloquea si RLS OK)

- **H9:** cifrado `marketplace_connections` / `meta_ads` con pgcrypto + Vault
- **H11:** rate-limit auth vía Supabase Dashboard (o CAPTCHA si hay abuso)
- Pentest externo anual

## G. Qué NO es vulnerabilidad

- `apikey` + `Bearer` visibles en DevTools en **tu** sesión
- Anon key en bundle JS (diseño Supabase)

## H. Hardening 2026-06-14 (branch `security/hardening-advisor-rate-limits`)

Basado en el **advisor en vivo del proyecto Skale correcto** (no la auditoría 2026-05-05 que corrió contra Nomadev).

### H.1 Migraciones (aplicar con `supabase db push` o MCP `apply_migration`)
- `20260614100000_lockdown_security_definer_grants.sql` — revoca `anon`/`authenticated` en funciones SECURITY DEFINER (triggers, helpers, ops de vendedor) + cierra escalada de privilegios en `provision_tenant` y `dispatch_webhook` (solo `service_role`) + `search_path` inmutable.
- `20260614100100_rls_formula_availability_whatsapp_creds.sql` — RLS explícita en `formula_availability_rules` y `whatsapp_inbox_credentials`.
- `20260614100200_rate_limit_infra.sql` — tabla `edge_rate_limits` + `check_rate_limit()` + rate-limit anti-spam en `formula_book_appointment` (5/email/hora).
- `20260614100300_perf_rls_initplan_optimize.sql` — envuelve `auth.uid()` en `(select auth.uid())` en 23 policies (mitiga DoS a escala).
- `20260614100400_fix_formula_pii_overexposure.sql` — elimina `USING(true)` que exponía PII de alumnos/pagos Fórmula a cualquier autenticado.
- `20260614100500_perf_fk_indexes.sql` — índices en 22 FKs.

### H.2 Rate / batch limits (Edge Functions)
Helper `supabase/functions/_shared/rateLimit.ts`. Límites aplicados:
- `vitrina-lead`: 20/min por IP · `landing-booking`: 30/min por IP
- `getapi-appraisal`: 30/min por usuario (protege API paga GetAPI)
- `lead-create`: 120/min por sucursal · `lead-state-update`: 240/min por sucursal
- RPC `formula_book_appointment`: 5/hora por email

### H.3 Supabase Dashboard (lo aplica el founder — no es código)
- [ ] **Auth → Password Protection → Pwned passwords (HaveIBeenPwned) = ON** (cierra advisor `auth_leaked_password_protection`).
- [ ] **Auth → MFA → TOTP = habilitado** (la UI ya existe vía `mfaPolicy.ts`).
- [ ] Confirmar Edge secrets: `ALLOWED_ORIGINS`, `STUDIO_IA_WEBHOOK_SECRET`, `LEGACY_BYPASS_EMAILS`.
- [ ] Tras `db push`: re-correr `get_advisors` (security + performance) y confirmar que bajaron los WARN.

### H.4 Smoke post-deploy
- [ ] `formula_book_appointment` con mismo email >5 veces/hora → `RATE_LIMITED`.
- [ ] `vitrina-lead` / `landing-booking` spameado por IP → `429`.
- [ ] Función trigger (`archive_lead_note_change`) ya no llamable por `anon` vía `/rest/v1/rpc`.
- [ ] Alumnos Fórmula NO visibles para un autenticado de otro tenant.
