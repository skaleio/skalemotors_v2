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
