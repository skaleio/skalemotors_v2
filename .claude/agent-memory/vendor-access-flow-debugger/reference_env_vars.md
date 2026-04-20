---
name: Env vars and secrets for vendor flow
description: Required environment variables for frontend (Vite) and Edge Function secrets
type: reference
---

## Frontend (.env file — NOT committed)
- `VITE_SUPABASE_URL` — project URL, no trailing slash. Example: `https://qszfkwshuhmedmzufalh.supabase.co`
- `VITE_SUPABASE_ANON_KEY` — public anon JWT

Both are exported from `src/lib/supabase.ts` as `supabaseUrl` and `supabaseAnonKey` and imported in `Users.tsx`.

## Edge Function Secrets (set via Supabase Dashboard → Project Settings → Edge Function Secrets, or `supabase secrets set`)
- `SUPABASE_URL` — auto-injected by Supabase runtime (no need to set manually in hosted env)
- `SUPABASE_ANON_KEY` — auto-injected by Supabase runtime
- `SUPABASE_SERVICE_ROLE_KEY` — **must be set manually** as a secret. If missing, function returns HTTP 500 "Missing Supabase env vars"

The Edge Function also accepts `PROJECT_URL` as alias for `SUPABASE_URL` and `SERVICE_ROLE_KEY` as alias for `SUPABASE_SERVICE_ROLE_KEY`.

## .env local — NOT used by Edge Functions
The `SUPABASE_SERVICE_ROLE_KEY=your_secret_key_here` in `.env` is for local Node scripts only. Edge Functions read from Supabase Secrets, not the local .env.

## Deploy command
```
supabase functions deploy vendor-user-create --project-ref <PROJECT_REF>
```
PROJECT_REF = `qszfkwshuhmedmzufalh` (from VITE_SUPABASE_URL)
