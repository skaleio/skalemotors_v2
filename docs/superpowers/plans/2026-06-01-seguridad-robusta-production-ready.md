# Seguridad robusta — Production Ready — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans for task-by-task execution.

**Goal:** Cerrar hallazgos críticos pre-MVP y dejar checklist operativo para activar MFA y secrets en producción.

**Architecture:** RLS-first en Postgres; auth en Edge via `requireAuth`; MFA gated por env en React; ingest y CORS acotados por secrets.

**Tech Stack:** Supabase (Postgres RLS, Auth MFA, Edge Functions), Vite React, Vercel serverless.

---

## Estado del código (2026-06-01)

| Tarea | Archivos | Estado |
|-------|----------|--------|
| C1 RLS IA admin+tenant | `20260827120000_risk_mitigation_pack.sql` | ✅ En repo |
| C2/C3 Edge IA auth | `studio-ia-generate`, `ai-generate`, `authGuard.ts` | ✅ En repo |
| C4 Signup sin fallback | `AuthContext.tsx` | ✅ En repo |
| C5 Lead ingest prod gate | `api/n8n-lead-ingest.ts` | ✅ En repo |
| C6 MFA env flags | `src/lib/mfaPolicy.ts` | ✅ Esta entrega |
| C7 expense_types RLS | `20260601143000_security_production_ready_pack.sql` | ✅ Esta entrega |
| Checklist ops | `docs/security/PRODUCTION_READY_CHECKLIST.md` | ✅ Esta entrega |
| Design spec | `docs/superpowers/specs/2026-06-01-seguridad-robusta-skalemotors-design.md` | ✅ Esta entrega |

---

### Task 1: Aplicar migraciones en Supabase productivo

**Files:** migraciones listadas arriba

- [ ] **Step 1:** `supabase link --project-ref qszfkwshuhmedmzufalh` (o el ref correcto)
- [ ] **Step 2:** `supabase db push`
- [ ] **Step 3:** Verificar `expense_types` → `\d+ expense_types` muestra RLS enabled

---

### Task 2: Activar flags en Vercel producción

**Files:** Vercel dashboard

- [ ] **Step 1:** Set `VITE_FLAG_INVESTOR_READY_SECURITY=true`
- [ ] **Step 2:** Redeploy frontend
- [ ] **Step 3:** Login como admin → debe exigir enroll MFA

---

### Task 3: Secrets Supabase + Vercel

- [ ] **Step 1:** `ALLOWED_ORIGINS` en Edge secrets
- [ ] **Step 2:** `LEAD_INGEST_ALLOWED_ORIGINS` en Vercel
- [ ] **Step 3:** Confirmar `N8N_LEAD_INGEST_API_KEY` **unset** en production

---

### Task 4: Dashboard Supabase manual

- [ ] **Step 1:** Pwned password protection ON
- [ ] **Step 2:** `get_advisors` sin ERROR críticos en proyecto Skale

---

### Task 5: Verificación

- [ ] **Step 1:** `npm run test` — incluye `mfaPolicy.test.ts`
- [ ] **Step 2:** Prueba cross-tenant manual (dos tenants)
- [ ] **Step 3:** `curl -X POST` Edge IA sin JWT → 401

---

### Task 6 (opcional): Altos del informe

Seguir `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md` sección 🟠 (H3–H14) en PRs separados (~300 líneas c/u).
