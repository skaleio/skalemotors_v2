# Security Auditor Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only security audit sub-agent for Skale Motors v2 — invokable via three slash commands (`/audit-fixes`, `/audit-full`, `/audit-diff`) — without modifying any application code.

**Architecture:** One Claude Code sub-agent (`.claude/agents/security-auditor.md`) holds the shared system prompt and tool allowlist. Three thin slash commands (`.claude/commands/audit-*.md`) prepare per-mode prompts and dispatch the sub-agent via the `Agent` tool. A new `.claude/settings.json` (shared, versioned) adds the minimum Bash allowlist the sub-agent needs.

**Tech Stack:** Claude Code (sub-agents, slash commands, settings.json), Markdown frontmatter, Bash + Grep + Read tools, MCP `supabase-skalemotors__*` read tools.

**Spec:** `docs/superpowers/specs/2026-05-09-security-auditor-agent-design.md`

---

## File Structure

| File | Purpose |
|------|---------|
| `.claude/agents/security-auditor.md` | Sub-agent definition (frontmatter + system prompt + embedded knowledge of stack, RLS, Edge Functions, hard rules) |
| `.claude/commands/audit-fixes.md` | Slash command `/audit-fixes` — validates the 41 findings of the pre-MVP report |
| `.claude/commands/audit-full.md` | Slash command `/audit-full [--scope=<dominio>] [--save]` — deep audit across 8 domains |
| `.claude/commands/audit-diff.md` | Slash command `/audit-diff [PR# \| branch]` — regression guardian over a diff |
| `.claude/settings.json` | Shared (versioned) Bash allowlist for the sub-agent (`npm audit`, `git diff`, `gh pr diff`, etc.) |
| `CLAUDE.md` (modify) | Add new section §13 documenting the agent and its three commands |
| `docs/security/.gitkeep` (verify) | Ensure `docs/security/` exists so `/audit-full --save` can write to it |

`.claude/settings.local.json` already exists and is gitignored — **do not touch it**. We add `.claude/settings.json` as the shared, versioned counterpart.

---

## Task 1: Create the sub-agent definition

**Files:**
- Create: `.claude/agents/security-auditor.md`

- [ ] **Step 1: Verify the directory does not yet exist**

Run: `ls .claude/agents 2>/dev/null || echo MISSING`
Expected: `MISSING` (we are creating it)

- [ ] **Step 2: Create the sub-agent file with full frontmatter and prompt**

Create `.claude/agents/security-auditor.md` with this exact content:

```markdown
---
name: security-auditor
description: Read-only security auditor for Skale Motors v2. Reviews RLS policies, Edge Functions auth, secrets, dependencies and HTTP headers. Invoke via /audit-fixes, /audit-full, or /audit-diff. NEVER modifies code.
model: sonnet
tools: Read, Grep, Glob, Bash, WebFetch, mcp__supabase-skalemotors__list_tables, mcp__supabase-skalemotors__get_advisors, mcp__supabase-skalemotors__list_migrations, mcp__supabase-skalemotors__list_extensions, mcp__supabase-skalemotors__list_edge_functions, mcp__supabase-skalemotors__execute_sql
---

You are the **security-auditor** sub-agent for **Skale Motors v2**, a multi-tenant SaaS for Chilean car dealerships built on React + TypeScript + Supabase (Postgres + RLS + Edge Functions).

## Your job

Audit the codebase for security vulnerabilities and produce an actionable report. You operate in three modes, selected by the slash command that invokes you (`/audit-fixes`, `/audit-full`, `/audit-diff`). The invoking command tells you which mode and what input to use.

## Hard rules (never violate)

1. **Never modify code.** You have no `Edit` or `Write` tool. If you think a fix should be applied, describe it — do not attempt it.
2. **Never run mutating SQL.** With `mcp__supabase-skalemotors__execute_sql` you ONLY run `SELECT` and `EXPLAIN`. No `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE`, `GRANT`, `REVOKE`.
3. **Never run mutating Bash.** No `npm install`, `git push`, `git commit`, `git checkout`, `gh pr merge`, `gh pr close`, `rm`, `mv`, `chmod`. Allowed: `npm audit`, `npm outdated`, `git diff`, `git log`, `git show`, `gh pr view`, `gh pr diff`, `gh pr list`, `grep`, `rg`, `ls`, `cat`, `head`, `tail`.
4. **Never expose secrets in plaintext.** When citing a secret env var, mask the value: `OPENAI_API_KEY=***`. Show only the variable name.
5. **Always cite `file:line`** for every finding so it is verifiable.
6. **Always classify severity** as 🔴 CRÍTICO / 🟠 ALTO / 🟡 MEDIO / 🟢 BAJO using a CVSS-like criterion. If you cannot prove the vector with concrete evidence, downgrade to MEDIO or move it to "Descartados (con razón)".

## Stack and critical paths (you do not need to rediscover these)

- `supabase/migrations/` — RLS policies, triggers, schema. **80+ migration files**. Look for `CREATE POLICY` and `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- `supabase/functions/` — **27 Edge Functions** (Deno). Each has `index.ts` and is registered in `supabase/config.toml`. Critical attribute: `verify_jwt = true` — when missing, anyone on the internet can invoke the function.
- `supabase/config.toml` — Edge Function registration. Look for missing `verify_jwt` flags.
- `src/contexts/AuthContext.tsx` — sign-in / sign-up / session management. Known weak point: manual signup fallback that bypasses `pending_vendor_provisions` (finding C4).
- `src/lib/services/` — **24 services**. Convention: every Supabase access goes through here. A `supabase.from(...)` call in a `src/components/**/*.tsx` is a regression.
- `api/n8n-lead-ingest.ts` and `api/chileautos-scrape.ts` — Vercel serverless endpoints. They authenticate with API keys, not JWTs.
- `vercel.json` (if present) — HTTP security headers (CSP, HSTS, X-Frame-Options).
- `package.json` — third-party dependencies. Run `npm audit --json` to assess.

## Priority vectors (the seven CRÍTICOs of the pre-MVP report)

You should always check these first. They are the project's most expensive failures if regressed:

- **C1**: Tenant bypass for `admin` role on AI tables (`ai_conversations`, `ai_messages`, `ai_usage_logs`, `ai_branch_brain`). The policy uses `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')` without filtering by `tenant_id`, allowing cross-tenant reads.
- **C2**: `supabase/functions/studio-ia-generate/index.ts` without `verify_jwt` → cost amplification on `OPENAI_API_KEY`.
- **C3**: `supabase/functions/ai-generate/index.ts` without `verify_jwt` → cost amplification on `ANTHROPIC_API_KEY`.
- **C4**: `src/contexts/AuthContext.tsx` ~lines 558-630 — manual `users.insert` fallback with `role: 'vendedor'` hardcoded, bypassing `pending_vendor_provisions`.
- **C5**: `N8N_LEAD_INGEST_API_KEY` env var allows lead injection into any branch (no per-branch scoping).
- **C6**: MFA not implemented in UI (single point of failure on password leak).
- **C7**: `expense_types` table without RLS / `tenant_id`.

The full list of findings (C1–C7, A1–A14, M1–M12, B1–B8) lives in `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md`.

## Output format (mandatory)

Always reply with this Markdown structure:

```
# Security Audit — <mode> — <YYYY-MM-DD>

## Resumen
| Severidad | Count |
|-----------|-------|
| 🔴 CRÍTICO | N |
| 🟠 ALTO    | N |
| 🟡 MEDIO   | N |
| 🟢 BAJO    | N |

**Veredicto:** ✅ aprobar | 🟡 observaciones | ❌ bloquear

## Hallazgos

### [CRÍTICO] <título corto>
- **Archivo:** `path/to/file.ts:42-58`
- **Vector:** <concrete attack scenario>
- **Evidencia:** `<code snippet that proves it>`
- **Fix sugerido:** <specific, actionable instruction>
- **Refs:** <OWASP / CWE / CVE if applicable>

### [ALTO] <título corto>
...

## Descartados (con razón)
- <potential finding> — discarded because <verifiable reason>
```

Each mode adds extra blocks (the invoking command will tell you which).

## Mode-specific behavior

When invoked, the slash command will hand you a prompt that begins with `MODE: audit-fixes`, `MODE: audit-full`, or `MODE: audit-diff` and includes the input parameters. Execute according to the mode.

If the mode is missing or ambiguous, **ask the calling command for clarification rather than guessing**. Do not silently default.

## Output language

The product is in **Spanish (Chile)**. Findings titles, vectors, and fix suggestions are written in Spanish. Code paths, Bash commands and tool names stay in English.
```

- [ ] **Step 3: Verify the file was written and frontmatter parses**

Run: `head -10 .claude/agents/security-auditor.md`
Expected: First lines are the YAML frontmatter delimited by `---`, with `name: security-auditor` visible.

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/security-auditor.md
git commit -m "feat(security): add security-auditor sub-agent definition"
```

---

## Task 2: Create `/audit-fixes` slash command

**Files:**
- Create: `.claude/commands/audit-fixes.md`

- [ ] **Step 1: Verify the commands directory does not yet exist**

Run: `ls .claude/commands 2>/dev/null || echo MISSING`
Expected: `MISSING` (we are creating it)

- [ ] **Step 2: Create the slash command file**

Create `.claude/commands/audit-fixes.md` with this exact content:

```markdown
---
description: Validar el estado de los hallazgos del informe AUDITORIA_SEGURIDAD_PRE_MVP.md (resuelto / parcial / pendiente / N/A) por cada uno de los 41 issues conocidos.
allowed-tools: Agent, Read, Grep, Glob
---

Vas a invocar al sub-agente `security-auditor` para validar el estado actual de los hallazgos del informe de seguridad pre-MVP.

**Pasos:**

1. Leé `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md` y extraé la lista de findings con su ID (C1, C2, ..., A1, ..., M1, ..., B1, ...). Cada finding tiene: ID, título, archivo + línea, fix sugerido.
2. Lanzá el sub-agente `security-auditor` con el `Agent` tool, `subagent_type=security-auditor`, pasándole este prompt:

```
MODE: audit-fixes
FUENTE: docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md

Tarea: por cada finding del informe (C1–C7, A1–A14, M1–M12, B1–B8 si existen), determiná su estado actual leyendo el archivo referenciado:

- ✅ RESUELTO: el fix sugerido está aplicado y cubre el vector.
- 🟡 PARCIAL: hay cambios pero no cubren todo el vector. Indicá qué falta.
- ❌ PENDIENTE: el código sigue vulnerable.
- ❓ N/A: el archivo cambió tanto que el finding ya no aplica. Justificá.

Para cada finding, ejecutá `git log -p <file>` para ver fixes recientes y citá el commit hash si encontrás uno relevante.

Devolvé el reporte con el formato Markdown estándar (ver tu system prompt) MÁS un bloque adicional al inicio:

## Tabla de estado por hallazgo
| ID | Título | Estado | Commit del fix |
|----|--------|--------|----------------|
| C1 | ...    | ✅/🟡/❌/❓ | abc1234 o "—" |
| ... |       |       |                |

El veredicto general es:
- ✅ APROBAR si todos los CRÍTICOs y ALTOs están RESUELTOS.
- 🟡 OBSERVACIONES si hay PARCIALes pero ningún PENDIENTE en CRÍTICOs/ALTOs.
- ❌ BLOQUEAR si hay aunque sea un CRÍTICO o ALTO PENDIENTE.
```

3. Cuando el sub-agente devuelva su reporte, mostralo tal cual al usuario.
```

- [ ] **Step 3: Verify the file was written**

Run: `head -5 .claude/commands/audit-fixes.md`
Expected: Frontmatter visible with `description:` line.

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/audit-fixes.md
git commit -m "feat(security): add /audit-fixes slash command"
```

---

## Task 3: Create `/audit-full` slash command

**Files:**
- Create: `.claude/commands/audit-full.md`

- [ ] **Step 1: Create the slash command file**

Create `.claude/commands/audit-full.md` with this exact content:

```markdown
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
   - `git ls-files | grep -E "\\.env(\\.|$)"` para detectar `.env*` trackeado.
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
```

- [ ] **Step 2: Verify**

Run: `head -5 .claude/commands/audit-full.md`
Expected: Frontmatter with `argument-hint:` line.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/audit-full.md
git commit -m "feat(security): add /audit-full slash command"
```

---

## Task 4: Create `/audit-diff` slash command

**Files:**
- Create: `.claude/commands/audit-diff.md`

- [ ] **Step 1: Create the slash command file**

Create `.claude/commands/audit-diff.md` with this exact content:

```markdown
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
```

- [ ] **Step 2: Verify**

Run: `head -5 .claude/commands/audit-diff.md`
Expected: Frontmatter with `argument-hint: [PR# | branch-name]`.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/audit-diff.md
git commit -m "feat(security): add /audit-diff slash command"
```

---

## Task 5: Create shared settings.json with Bash allowlist

**Files:**
- Create: `.claude/settings.json`

`.claude/settings.local.json` is gitignored and personal. We add `.claude/settings.json` (shared, versioned) with the minimum allowlist the security-auditor sub-agent needs.

- [ ] **Step 1: Verify the shared settings file does not exist yet**

Run: `test -f .claude/settings.json && echo EXISTS || echo MISSING`
Expected: `MISSING`

- [ ] **Step 2: Create the file**

Create `.claude/settings.json` with this exact content:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm audit:*)",
      "Bash(npm outdated:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(gh pr view:*)",
      "Bash(gh pr diff:*)",
      "Bash(gh pr list:*)",
      "Bash(rg:*)",
      "Bash(grep:*)"
    ]
  }
}
```

- [ ] **Step 3: Verify it parses as valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.json
git commit -m "chore(security): add shared Bash allowlist for security-auditor sub-agent"
```

---

## Task 6: Ensure docs/security/ exists for `--save`

`/audit-full --save` writes reports into `docs/security/`. The directory already exists (it contains `AUDITORIA_SEGURIDAD_PRE_MVP.md` and `SEGURIDAD.md`), so no action is needed unless the directory ever gets emptied.

- [ ] **Step 1: Verify the directory exists**

Run: `test -d docs/security && echo EXISTS || echo MISSING`
Expected: `EXISTS`

If `MISSING`, create `docs/security/.gitkeep` and commit it. Otherwise skip this task entirely.

---

## Task 7: Document the agent in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (append a new section §13 right after §12)

- [ ] **Step 1: Read the end of CLAUDE.md to find the insertion point**

Run: `tail -20 CLAUDE.md`
Expected: The file ends with section §12 ("Fuera de alcance / no tocar") and a final closing line. Identify the exact last line so the next step's `old_string` is unambiguous.

- [ ] **Step 2: Append the new §13 section**

Use `Edit` with `old_string` = the exact final closing line (e.g. the line that reads `**Cuando dudes, preguntá antes de actuar.** El costo de confirmar es bajo; el costo de un cambio masivo no pedido es alto.`) and `new_string` = the same line followed by:

```markdown


---

## 13. Sub-agente `security-auditor`

Auditor de seguridad **read-only** versionado en `.claude/agents/security-auditor.md`. Tres slash commands lo invocan:

| Comando | Cuándo usarlo |
|---------|---------------|
| `/audit-fixes` | Validar el estado de los 41 hallazgos del informe pre-MVP. Ideal antes del refactor. |
| `/audit-full [--scope=X] [--save]` | Auditoría profunda en 8 dominios (RLS, Edge Functions, auth, secrets, frontend, headers, deps, Vercel). `--save` persiste a `docs/security/audit-<fecha>.md`. |
| `/audit-diff [PR# \| branch]` | Revisión rápida del diff actual o de un PR. Usar antes de `gh pr ready` y antes de mergear a `main`. |

**Reglas duras del agente:**

- Nunca modifica código.
- Nunca corre SQL que mute (solo `SELECT` / `EXPLAIN`).
- Nunca expone secrets en plano (los enmascara como `OPENAI_API_KEY=***`).
- Toda finding cita `archivo:línea`.

Spec: `docs/superpowers/specs/2026-05-09-security-auditor-agent-design.md`. Plan de implementación: `docs/superpowers/plans/2026-05-09-security-auditor-agent.md`.

Trigger sugerido (Claude lo recuerda al usuario, no lo dispara solo) cuando se editan archivos sensibles: `supabase/migrations/`, `supabase/functions/`, `src/contexts/AuthContext.tsx`, `src/lib/services/`, `api/*.ts`, `package.json`.
```

- [ ] **Step 3: Verify the section was added**

Run: `grep -c "^## 13. Sub-agente" CLAUDE.md`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(security): documentar sub-agente security-auditor en CLAUDE.md"
```

---

## Task 8: Smoke test — verify the three commands are recognized

The slash commands need a Claude Code session reload to be picked up. After reload, each one is invoked manually to confirm wiring (the agent should at minimum start, parse the mode, and not crash). This is a manual step performed by the user.

- [ ] **Step 1: Reload plugins so Claude Code picks up the new agent and commands**

In the Claude Code chat, the user runs:

```
/reload-plugins
```

Expected output: Includes a line like `Reloaded: ... agents · ... skills · 3 user-defined commands ...` (the exact wording depends on the version, but the count of user-defined commands should reflect the three new ones).

- [ ] **Step 2: Smoke test `/audit-diff`**

In the Claude Code chat, the user runs:

```
/audit-diff
```

Expected behavior:
- Claude Code launches the `security-auditor` sub-agent.
- The sub-agent obtains the diff with `git diff main...HEAD`.
- The sub-agent returns a Markdown report with the standard structure (`# Security Audit — audit-diff — <fecha>`, `## Resumen` table, `## Hallazgos`, `## Descartados`).
- Since the only changes on this branch are docs / `.claude/`, the verdict should be ✅ APROBAR with no high-severity findings.

If the sub-agent crashes, hangs, or refuses to start, capture the error and stop. Likely causes:
- Frontmatter typo in `security-auditor.md`.
- Missing tool in the sub-agent's `tools:` list.
- Allowlist gap in `.claude/settings.json` (run was blocked on a `Bash(...)` permission prompt).

- [ ] **Step 3: Smoke test `/audit-fixes`**

The user runs:

```
/audit-fixes
```

Expected behavior:
- Sub-agent reads `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md`.
- Returns the standard report PLUS the per-finding state table (Task 2 step 2).
- Verdict reflects current state (likely ❌ BLOQUEAR since the report is fresh and most CRÍTICOs are pending).

- [ ] **Step 4: Smoke test `/audit-full --scope=deps`**

The user runs:

```
/audit-full --scope=deps
```

Expected behavior:
- Sub-agent runs `npm audit --json`.
- Reports only the `Dependencies` domain (because `--scope=deps`).
- Coverage table shows only one row (deps).
- The smoke test does NOT use `--save` to keep the test reversible.

- [ ] **Step 5: Document smoke test results**

If all three commands ran cleanly, append a one-liner to the PR description before marking it ready:

> Smoke test: `/audit-diff`, `/audit-fixes`, `/audit-full --scope=deps` ejecutaron sin errores y devolvieron reportes con el formato estándar.

---

## Task 9: Open the draft PR following the project workflow

**Files:** none (uses `gh`).

The branch `docs/security-auditor-agent-spec` already has the spec commit. After Tasks 1–8, it has 7 more commits. The project workflow (CLAUDE.md §10.3) requires opening the draft PR after the **first** commit; we are doing it after the spec commit was already made. The PR was not opened earlier, so we open it now and the remaining commits will accumulate on it.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin docs/security-auditor-agent-spec
```

- [ ] **Step 2: Create the draft PR using the project template**

```bash
gh pr create --draft --title "feat(security): sub-agente security-auditor + 3 slash commands" --body "$(cat <<'EOF'
## Objetivo

Agregar un sub-agente custom `security-auditor` (read-only) y tres slash commands (`/audit-fixes`, `/audit-full`, `/audit-diff`) que centralizan la auditoría de seguridad del repo. Sirve para cerrar el MVP (validar los 41 hallazgos del informe pre-MVP) y queda como guardian recurrente.

## Cambios

- `.claude/agents/security-auditor.md` — definición del sub-agente con prompt completo, tools allowlist y reglas duras.
- `.claude/commands/audit-fixes.md` — valida hallazgos del informe pre-MVP.
- `.claude/commands/audit-full.md` — auditoría profunda en 8 dominios, soporta `--scope=` y `--save`.
- `.claude/commands/audit-diff.md` — guardian de regresiones para diff/PR.
- `.claude/settings.json` — allowlist Bash mínima compartida (versionada).
- `CLAUDE.md` §13 — documenta el agente y los comandos.
- `docs/superpowers/specs/2026-05-09-security-auditor-agent-design.md` — spec.
- `docs/superpowers/plans/2026-05-09-security-auditor-agent.md` — plan.

## Decisiones

- Read-only por contrato. Sin Edit/Write/mutación SQL.
- Modelo `sonnet` (balance precisión/costo).
- Trigger manual + sugería desde Claude. Sin hook automático.
- Versionado en `.claude/` del proyecto, no global.

## Asunciones

- El proyecto Supabase MCP `supabase-skalemotors` apunta al proyecto correcto (la auditoría previa flagueó que estaba apuntando a NOMADEV.IO; esta PR no resuelve eso, solo arma la herramienta).
- El informe `AUDITORIA_SEGURIDAD_PRE_MVP.md` no se mueve de path.

## Pendientes / follow-ups

- Próxima PR: ejecutar `/audit-fixes` y crear issues por cada finding pendiente.
- v2 del agente: comparativa diff entre auditorías sucesivas, integración con GitHub Actions.

## Cómo probar

1. `/reload-plugins`
2. `/audit-diff` — debería devolver veredicto APROBAR sobre esta misma branch.
3. `/audit-fixes` — debería listar el estado de los 41 findings del informe pre-MVP.
4. `/audit-full --scope=deps` — debería correr `npm audit` y reportar solo el dominio Dependencies.

## Refs

- Spec: `docs/superpowers/specs/2026-05-09-security-auditor-agent-design.md`
- Plan: `docs/superpowers/plans/2026-05-09-security-auditor-agent.md`
- Informe pre-MVP: `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md`
EOF
)"
```

Expected output: A draft PR URL on `github.com/<owner>/skalemotors_v2`.

- [ ] **Step 3: Verify the PR was created**

```bash
gh pr view --json number,isDraft,title
```

Expected: `isDraft: true`, title matches.

The user marks the PR ready (`gh pr ready`) only after Task 8 smoke tests pass.

---

## Self-review notes

**Spec coverage:** Each section of the spec maps to a task — Section 4 (agent base) → Task 1; Section 5 (slash commands) → Tasks 2–4; Section 7 (settings) → Task 5; Section 9 (success criteria) → Task 8 smoke tests; criterion §9.1 → Tasks 1–4 + 5; §9.2 → Task 5; §9.3–§9.6 → Task 8.

**Placeholders:** None — every code/config block is the final content. No "TBD", no "fill in later".

**Type/path consistency:** All file paths use Windows-style absolute under the project root (`.claude/agents/security-auditor.md` etc.) consistently across tasks. Sub-agent name `security-auditor` is stable in every reference.

**Smoke test scope:** The smoke test in Task 8 deliberately uses `--scope=deps` (cheapest domain, fastest) and does NOT use `--save` to avoid creating a stray report file during testing.
