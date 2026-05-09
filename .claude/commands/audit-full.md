---
description: Auditoría profunda de seguridad en 8 dominios (RLS, Edge Functions, Auth, Secrets, Frontend, Headers HTTP, Dependencies, Vercel endpoints). Soporta --scope=<dominio> y --save.
argument-hint: [--scope=<dominio>] [--save]
allowed-tools: Agent, Read, Grep, Glob, Write
---

Vas a invocar al sub-agente `security-auditor` para correr una auditoría profunda.

**Parseo de argumentos** (en `$ARGUMENTS`):

- Si contiene `--scope=<X>`, X es uno de: `rls`, `edge-functions`, `auth`, `secrets`, `frontend`, `headers`, `deps`, `vercel`. Default: `all`.
- Si contiene `--save`, al final del flow escribís el reporte en `docs/security/audit-<YYYY-MM-DD>.md` (donde `<YYYY-MM-DD>` es la fecha actual). Si el archivo ya existe, agregá un sufijo `-1`, `-2`, etc.

**Pasos:**

1. Lanzá el sub-agente `security-auditor` con `Agent` tool, `subagent_type=security-auditor`, con este prompt:

```
MODE: audit-full
SCOPE: <rls|edge-functions|auth|secrets|frontend|headers|deps|vercel|all>

Tarea: ejecutá una auditoría profunda. Para cada dominio en scope (si scope=all, los 8):

1. **RLS policies** — recorré las migraciones en `supabase/migrations/`. Por cada `CREATE POLICY`, verificá:
   - Que toda tabla con `tenant_id` filtre por él en USING/WITH CHECK.
   - Que no haya `USING (true)` permisivo (excepto en tablas globales legítimas).
   - Que policies con `role = 'admin'` también filtren por `tenant_id`.
   Llamá a `mcp__supabase-skalemotors__list_tables` y `mcp__supabase-skalemotors__get_advisors` para complementar.

2. **Edge Functions** — listá `supabase/functions/`, abrí `supabase/config.toml`. Por cada función, verificá:
   - `verify_jwt = true` (a menos que sea webhook público con justificación).
   - Que el handler valide `auth.uid()` y `tenant_id` server-side antes de tocar la BD.
   - Que tenga rate-limit si llama a APIs externas pagas (OpenAI, Anthropic, GetAPI).

3. **Auth flows** — leé `src/contexts/AuthContext.tsx`. Verificá:
   - No hay fallback de signup que bypass `pending_vendor_provisions`.
   - Password reset valida tokens server-side.
   - Session timeout existe.
   - MFA está habilitado o documentado como roadmap.

4. **Secrets & env** — buscá:
   - `git ls-files | grep -E "\.env(\.|$)"` para detectar `.env*` trackeado.
   - `rg "VITE_" src/` y verificá que ningún `VITE_*` contenga un secret (Vite expone esas vars al cliente).
   - `rg "api.key|API_KEY|secret|password" src/ --type=ts` con ojo de detectar hardcodes.

5. **Frontend** — buscá:
   - `dangerouslySetInnerHTML` en `src/`.
   - `document.write` en `src/`.
   - `localStorage.setItem` con tokens / JWTs.
   - URLs de imágenes / iframes sin validar dominio.

6. **HTTP headers** — leé `vercel.json` (si existe) o `vite.config.ts`. Verificá:
   - CSP definido.
   - HSTS en producción.
   - X-Frame-Options o frame-ancestors.
   - Referrer-Policy.

7. **Dependencies** — corré `npm audit --json` y resumí: total de high/critical vulnerabilidades, paquetes afectados.

8. **Vercel endpoints** — leé `api/*.ts`. Verificá:
   - Auth (API key o JWT) antes de tocar la BD.
   - Validación de input con Zod o equivalente.
   - Rate-limit.

Para cada dominio, devolvé hallazgos con el formato estándar. Agregá al inicio:

## Cobertura
| Dominio | Archivos revisados | Hallazgos |
|---------|--------------------|-----------|
| RLS | N migraciones | M |
| ... |                    |   |
```

2. Cuando el sub-agente devuelva el reporte:
   - Mostralo al usuario.
   - Si `$ARGUMENTS` contiene `--save`, escribilo a `docs/security/audit-<YYYY-MM-DD>.md` usando la herramienta `Write`. Si el archivo ya existe, sumá sufijo numérico.
