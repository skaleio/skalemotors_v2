---
description: Guardian de regresiones — revisa el diff (branch actual, otra branch, o un PR de GitHub) buscando huecos de seguridad introducidos. Veredicto APROBAR / OBSERVACIONES / BLOQUEAR.
argument-hint: [PR# | branch-name]
allowed-tools: Agent, Bash, Read, Grep
---

Vas a invocar al sub-agente `security-auditor` para revisar un diff.

**Parseo de argumentos** (en `$ARGUMENTS`):

- Sin args: el diff es `git diff main...HEAD`.
- Si es un número (ej: `42`): el diff es `gh pr diff 42`.
- Si es un nombre de branch (ej: `feat/foo`): el diff es `git diff main...feat/foo`.

**Pasos:**

1. Determiná el comando exacto según el argumento y obtené el diff con `Bash`.
2. Lanzá el sub-agente `security-auditor` con `Agent` tool, `subagent_type=security-auditor`, pasándole este prompt:

```
MODE: audit-diff
INPUT: <pegá acá el diff completo, o si es muy largo, un resumen de los archivos cambiados con `git diff --stat`>
FUENTE: <"branch local main...HEAD" | "PR #42" | "branch feat/foo">

Tarea: revisá el diff buscando regresiones de seguridad. Filtrá archivos sensibles primero:
- `supabase/migrations/*.sql`
- `supabase/functions/**/index.ts`
- `supabase/config.toml`
- `src/contexts/AuthContext.tsx`
- `src/lib/services/**`
- `api/*.ts`
- `package.json` (deps nuevas)
- `vercel.json`, `vite.config.ts` (cambios de headers o build)

Patrones de regresión a detectar (son los más frecuentes en Skale Motors):

1. **RLS policy nueva sin tenant filter** — `CREATE POLICY` con `USING (...)` que no incluye `tenant_id` en una tabla que sí lo tiene.
2. **Edge Function nueva sin verify_jwt** — agregada en `supabase/config.toml` sin `verify_jwt = true`.
3. **Edge Function que llama OpenAI/Anthropic sin auth** — `index.ts` que usa `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` y no valida `auth.uid()`.
4. **`supabase.from(...)` directo en componente** — el proyecto exige que todo acceso pase por `src/lib/services/`. Si aparece en `src/components/**` o `src/pages/**`, es regresión.
5. **Console.log con tokens / JWTs** — `console.log(...token...)` o `console.log(...jwt...)`.
6. **`process.env.X` o `import.meta.env.VITE_X` que filtra secret al cliente** — variables `VITE_*` quedan expuestas en el bundle. Si una de ellas tiene nombre que sugiere secret (`VITE_*_KEY`, `VITE_*_SECRET`), es regresión.
7. **Dep nueva con CVE conocido** — corré `npm audit --json` con la dep nueva y reportá si hay highs/criticals.
8. **`dangerouslySetInnerHTML` o `document.write` nuevo** — XSS vector.
9. **Hardcoded API key / token / password** — strings tipo `Bearer eyJ...`, `sk-...`, `key=...`.

Por cada hit emitís el hallazgo con formato estándar. Veredicto:
- ✅ APROBAR si no hay hallazgos o solo BAJOs.
- 🟡 OBSERVACIONES si hay MEDIOs.
- ❌ BLOQUEAR si hay CRÍTICOs o ALTOs.

Latencia objetivo: <60s para diffs <300 líneas.
```

3. Mostrá el reporte del sub-agente al usuario.
