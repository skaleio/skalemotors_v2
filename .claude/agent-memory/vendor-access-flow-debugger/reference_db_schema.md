---
name: DB schema, trigger and RLS for vendor flow
description: pending_vendor_provisions table, handle_new_user_signup trigger, and RLS policies affecting team visibility
type: reference
---

## pending_vendor_provisions table
Migration: `supabase/migrations/20260416130000_pending_vendor_provisions.sql`
- Columns: id, email TEXT, tenant_id UUID (FK tenants), branch_id UUID (FK branches, nullable), role TEXT CHECK('vendedor'), expires_at TIMESTAMPTZ (24h TTL), created_at
- RLS enabled, no SELECT/INSERT policy for authenticated — only service_role (Edge Function admin client) can write
- Index on `lower(trim(email))` — must match exactly how Edge Function normalizes email

## Trigger
- Function: `public.handle_new_user_signup()` SECURITY DEFINER
- Trigger: `on_auth_user_created` AFTER INSERT ON auth.users FOR EACH ROW
- First defined in: `20260326400000_multitenant_complete.sql` (line 601)
- Updated (CREATE OR REPLACE, no re-CREATE TRIGGER needed): `20260416130000_pending_vendor_provisions.sql`
- Logic: if pending row found for email → insert vendedor into public.users with tenant/branch from provision; else → create new tenant + branch + admin user (self-registration path)

## RLS on public.users (latest policy as of 20260816140000)
- SELECT policy `users_select_same_tenant`: `tenant_id = current_tenant_id() OR current_is_legacy_protected()`
  → A newly created vendor IS visible to admins/managers querying their same tenant_id
- UPDATE policy `users_update_self_safe`: users can only update their own row; role/tenant/legacy_protected/is_active are immutable via this policy
- No INSERT policy for authenticated — only SECURITY DEFINER trigger or service_role can insert

## Critical: onboarding_completed
The trigger sets `onboarding_completed = true` for vendor rows (line 93 in 20260416130000). This is important because `AuthContext.fetchUserProfile` checks this to set `needsOnboarding`. Vendors go directly to the app without onboarding flow.
