---
name: Known pitfalls and validated patterns in vendor flow
description: Confirmed bugs fixed, gotchas, and patterns that work correctly in this codebase
type: feedback
---

## SUPABASE_SERVICE_ROLE_KEY must be set as Supabase Secret, not in .env
The `.env` file has `SUPABASE_SERVICE_ROLE_KEY=your_secret_key_here` (placeholder). This does NOT reach the Edge Function. Edge Functions read from Supabase Secrets (Dashboard → Settings → Secrets or `supabase secrets set`). If missing, function returns HTTP 500 "Missing Supabase env vars" and the UI shows "Creando…" forever (no error toast) because the request technically succeeds at the network level but returns a non-ok body.

**Why:** Vite/Node `.env` variables are not propagated to the Supabase hosted Edge Function runtime.
**How to apply:** Always verify secrets are set in the Dashboard before debugging Edge Function 500 errors.

## invalidateQueries with partial key works in TanStack Query v5
`queryClient.invalidateQueries({ queryKey: ["tenant_users"] })` correctly invalidates `["tenant_users", tenant_id]` in v5 (fuzzy match is default). No need for `exact: false`. This is not a bug.

**Why:** TanStack Query v5 changed some API but kept fuzzy matching for invalidation.

## onSuccess form reset was missing newBranchId
The `onSuccess` callback in `createVendorMutation` did not reset `newBranchId`, leaving the previously selected branch in state for the next creation. Fixed 2026-04-17.

## Edge Function error logs
Added `console.error` logging for: missing env vars (with field names), pending_vendor_provisions insert errors, and auth.admin.createUser errors. These appear in Supabase Dashboard → Edge Function Logs without exposing secrets or email content beyond what's already in the error.

## gerente/jefe_sucursal branch restriction
The Edge Function enforces: if caller role is `gerente` or `jefe_sucursal`, `callerRow.branch_id` must equal the requested `branchId`. This means these roles can ONLY create vendors for their own branch. `admin` and `jefe_jefe` can create for any branch in their tenant.

## trigger vs self-registration path
The trigger `handle_new_user_signup` has two paths:
1. If `pending_vendor_provisions` row found → vendor path (no new tenant)
2. If not found → self-registration path (creates new tenant, branch, admin user)
The `expires_at` check (24h TTL) means provisions older than 24h are ignored and the trigger falls through to path 2, potentially creating a spurious new tenant. The Edge Function always deletes the old provision and inserts fresh before calling createUser, so TTL is effectively never hit in normal operation.

## AuthContext login for new vendors
When a new vendor logs in, `fetchUserProfile` queries `public.users`. If the trigger hasn't fired yet (race condition), it retries with exponential backoff (1s, 2s, 4s, max 3 retries). In practice the trigger fires synchronously during `createUser`, so the row is always present by the time the vendor first logs in.

## VITE_PUBLIC_APP_URL and reset password redirect
`VITE_PUBLIC_APP_URL` must be set and added to Supabase Auth → Redirect URLs for password recovery emails to work. Not set in current `.env` (empty). This affects the "Enlace recuperación" button in the team table.
