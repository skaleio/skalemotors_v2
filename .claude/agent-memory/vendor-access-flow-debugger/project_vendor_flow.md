---
name: SkaleMotors vendor provisioning flow context
description: Tech stack, key file paths, and architecture of the vendor creation flow
type: project
---

**Stack**: Vite + React + TypeScript + Supabase (Auth, Postgres, RLS, Edge Functions Deno). TanStack Query v5.

**Why:** Vendors need their own login credentials scoped to their tenant and branch. Self-registration is not allowed to prevent tenant boundary violations.

**How to apply:** Any change to vendor creation must preserve the pending_vendor_provisions pattern — Edge Function inserts provision row BEFORE calling auth.admin.createUser, then the trigger consumes it.

## Key file paths
- Modal + mutation: `src/pages/Users.tsx` — `submitCreate` → `createVendorMutation` → `createVendorViaEdgeFunction`
- Edge Function: `supabase/functions/vendor-user-create/index.ts`
- CORS shared: `supabase/functions/_shared/cors.ts`
- Trigger migration: `supabase/migrations/20260416130000_pending_vendor_provisions.sql`
- Base trigger registration: `supabase/migrations/20260326400000_multitenant_complete.sql` (line 600-604)
- Supabase client: `src/lib/supabase.ts`
- Auth context: `src/contexts/AuthContext.tsx`

## Flow pipeline (in order)
1. Admin fills modal in `/app/users` → `submitCreate` validates client-side
2. `createVendorViaEdgeFunction` POSTs to `${SUPABASE_URL}/functions/v1/vendor-user-create`
   - Headers: `Authorization: Bearer <session.access_token>`, `apikey: <ANON_KEY>`
3. Edge Function: validates caller role (CAN_CREATE set), branch ownership, inserts into `pending_vendor_provisions`, calls `admin.auth.admin.createUser`
4. Postgres trigger `on_auth_user_created` (AFTER INSERT ON auth.users) calls `handle_new_user_signup()`
5. Trigger finds pending row by `lower(trim(email))`, validates branch belongs to tenant, inserts into `public.users` with role=vendedor, tenant_id, branch_id, `onboarding_completed=true`
6. Edge Function returns `{ ok: true, user_id, email }`
7. `onSuccess`: `invalidateQueries(["tenant_users"])` (fuzzy match for `["tenant_users", tenant_id]`), closes modal, shows toast
8. Vendor logs in at `/login` → `signIn` → `fetchUserProfile` loads from `public.users`

## TanStack Query keys
- Team list: `["tenant_users", user.tenant_id]`
- Branches: `["branches", "users_page", user.tenant_id]`
- Sales staff: `["branch_sales_staff", "users_create_vendor", user.tenant_id, user.branch_id]`
