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
