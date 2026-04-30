---
name: Security audit findings — identity flow
description: Findings from 2026-04-17 audit of AuthContext fallback user, public signup, RLS, and RBAC issues
type: project
---

Audit conducted 2026-04-17. Main findings:

1. **buildFallbackUserFromSession** sets `tenant_id: undefined` and `is_active: true` — if fetchUserProfile fails (network, RLS error), the user lands in /app with no tenant and role defaulting to "gerente". This is the most likely cause of "random user logged in".

2. **signUp (Register)** is public-facing with role 'admin' in user_metadata. Registration is open (`enable_signup = true`). Anyone who registers gets a new tenant + admin role via the trigger. This is intended for onboarding but exposes a public admin creation surface.

3. **Role in JWT**: `roleFromSessionUser` reads from `app_metadata.role` first (server-controlled), then falls back to `user_metadata.role` (user-writable at signup). Admin-created vendor users have `app_metadata.role = "vendedor"` set by the Edge Function, so they are safe. Self-registered users get role set by the trigger (always 'admin'), not from user_metadata.

4. **ProtectedRoute**: only checks `user` (context) and `user.is_active`. If the fallback user is active with `tenant_id: undefined`, the route guard lets them through.

5. **P0 fix needed**: in `signIn`, when `fetchUserProfile` returns false AND there is no cached profile, do NOT call `buildFallbackUserFromSession` — instead call `signOut()` and return an error to the UI.

**Why:** The fallback was designed for network timeout resilience (45s), but it creates a security bypass when public.users has no row for the auth.users.id.

**How to apply:** Any fix to signIn/onAuthStateChange must enforce: JWT valid + public.users row with tenant_id NOT NULL = required to enter /app. No exceptions for fallback.

## 2026-04-30 — Cross-tenant data leak (legacy_protected) — RESOLVED

**Symptom:** Logging in as `hessen@test.io` showed data from `miami@motors.cl` (different tenant). Reported by user as critical.

**Root cause:** `hessen@test.io` had `legacy_protected = true` in `public.users`. Every RLS policy is written as `tenant_id = current_tenant_id() OR current_is_legacy_protected()`, so this flag bypassed tenant isolation entirely. By design (super-admin during multitenant migration), but no longer desired.

**Fix applied (BD):**
1. `update public.users set legacy_protected = false where lower(email) = 'hessen@test.io'`. Now zero users have the flag enabled.
2. Backfilled orphan rows with `tenant_id IS NULL`: 63 leads + 1 sale via `branch.tenant_id`; 8 leads + 2 sales (no branch_id) assigned to `legacy-skale` tenant. Post-fix counts: SkaléMotors Legacy = 249 leads / 17 vehicles / 15 sales / 3 appointments; MIAMI MOTORS = 36 leads / 0 vehicles. Zero NULL tenants in leads/sales/vehicles/appointments.

**Fix applied (cliente, defense-in-depth):**
1. `queryClient.clear()` on signOut, on `SIGNED_OUT` event, on BroadcastChannel SIGNED_OUT, and at start of signIn (when previous user was loaded). Previously TanStack cache lived 10min after logout and could repaint UI with previous user's data on relogin.
2. `clearTenantContext()` helper added to `src/lib/tenant.ts`: removes `skale.tenant-context` AND every `skale.user-profile.*` key. Called from same lifecycle points as queryClient.clear().
3. `tenant_id` added to query keys that previously had no scope or only `branchId`: `["sales", tenantId, ...]`, `["sales-stats", tenantId, ...]`, `["fund-management", tenantId, ...]`, `["financial-tracking", tenantId, ...]`, `["balance-by-month", tenantId, ...]`, `["tramites", tenantId, ...]`, `["autofact-config", tenantId, ...]`, `["salary-distribution", tenantId, ...]`. Hooks now consume `useAuth()` to read tenant_id.

**Why:** Even with RLS protecting at DB level, TanStack cache + localStorage profile cache must not survive between logins or be addressable without tenant scope. Otherwise data of user A briefly renders for user B until refetch.

**Untouched (intentional):**
- `current_is_legacy_protected()` function and all RLS OR clauses kept in place. They are now inert (no user has the flag) and removing them would require rewriting ~15 migrations.
- Catalogs without tenant_id (`expense_types`, `tramite-tipos`) kept ungrouped — they are global lookups.
- Branches `Miami Motors` and `Hessen Motors Sucursal MiamiMotors` in the Legacy tenant: not reclassified. Need separate analysis of which leads/vehicles/sales live there before moving.
