# Security Auditor Agent — Design

**Fecha:** 2026-05-09
**Autor:** brainstorming entre Antonio + Claude Code
**Estado:** aprobado por el usuario, listo para implementación

---

## 1. Objetivo

Crear un sub-agente custom de Claude Code dedicado a **auditoría read-only de seguridad** para Skale Motors v2. Sirve dos propósitos:

1. **Cerrar el MVP** validando que los 41 hallazgos del informe `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md` están resueltos (o decididos como aceptables) antes del refactor.
2. **Auditoría continua** una vez en producción: revisar diffs, correr auditorías profundas periódicas, y detectar regresiones antes de mergear.

El agente **nunca modifica código**. Solo lee, analiza y reporta.

---

## 2. Decisiones tomadas

| Decisión | Elección |
|----------|----------|
| Scope | Tres modos: validar fixes, auditoría profunda, guardian de diff |
| Ubicación | `.claude/agents/` y `.claude/commands/` (proyecto, versionado en git) |
| Modelo | Sonnet 4.6 |
| Trigger | Manual + auto-sugería (Claude sugiere correrlo, nunca dispara solo) |
| Permisos | Solo lectura. Sin Edit/Write sobre código de la app. |
| Output | Reporte estructurado en chat. Opción `--save` solo en `/audit-full`. |

---

## 3. Arquitectura

```
.claude/
├── agents/
│   └── security-auditor.md          # agente base (prompt compartido + tools)
└── commands/
    ├── audit-fixes.md               # /audit-fixes
    ├── audit-full.md                # /audit-full [--scope=<dominio>] [--save]
    └── audit-diff.md                # /audit-diff [PR# | branch]
```

### Flujo de invocación

```
Usuario escribe /audit-diff
       ↓
Slash command (.claude/commands/audit-diff.md) carga prompt específico del modo "diff"
       ↓
Despacha al agente "security-auditor" con ese prompt
       ↓
Agente corre con tools read-only
       ↓
Devuelve reporte estructurado al chat principal
```

### Trigger proactivo (Claude en sesión normal, no el agente)

Cuando Claude detecta edits en archivos sensibles, **al final del turno** sugiere:
> "Tocaste `supabase/migrations/X.sql`. ¿Corremos `/audit-diff` antes de marcar la PR como ready?"

Sugiere — no ejecuta. Cero interrupción al flow.

**Tabla de triggers:**

| Trigger | Sugerencia |
|---------|-----------|
| Edit en `supabase/migrations/*.sql` | `/audit-diff` |
| Edit en `supabase/functions/**/index.ts` | `/audit-diff` |
| Edit en `src/contexts/AuthContext.tsx` | `/audit-diff` |
| Edit en `src/lib/services/**` | `/audit-diff` |
| Edit en `api/*.ts` | `/audit-diff` |
| Cambio en `package.json` (deps nuevas) | `/audit-diff` |
| Antes de `gh pr ready` | `/audit-diff` |
| Antes de merge a `main` | `/audit-fixes` si aún hay pendientes del informe |
| Mensual / pre-release | `/audit-full --save` |

---

## 4. Agente base (`security-auditor.md`)

### Frontmatter

```yaml
---
name: security-auditor
description: Auditor de seguridad read-only para Skale Motors v2. Revisa RLS, Edge Functions, auth flows, secrets, deps y cabeceras HTTP. Invocar manual vía /audit-fixes, /audit-full o /audit-diff. NO modifica código.
model: sonnet
tools: Read, Grep, Glob, Bash, WebFetch, mcp__supabase-skalemotors__list_tables, mcp__supabase-skalemotors__get_advisors, mcp__supabase-skalemotors__list_migrations, mcp__supabase-skalemotors__execute_sql
---
```

### Conocimiento embebido en el prompt

1. **Stack y rutas críticas** (no las redescubre cada vez):
   - `supabase/migrations/` — RLS policies, triggers
   - `supabase/functions/` — 27 Edge Functions, foco en `verify_jwt`, validación de tenant server-side
   - `src/contexts/AuthContext.tsx` — fallback de signup (hallazgo C4 conocido)
   - `src/lib/services/` — único punto de acceso a Supabase desde frontend
   - `api/n8n-lead-ingest.ts`, `api/chileautos-scrape.ts` — endpoints Vercel

2. **Vectores prioritarios para Skale Motors** (los 7 críticos del informe):
   - C1: Bypass tenant en role admin (tablas IA)
   - C2: Edge Function `studio-ia-generate` sin auth
   - C3: Edge Function `ai-generate` sin auth
   - C4: Fallback manual de signup
   - C5: MFA ausente
   - C6: `N8N_LEAD_INGEST_API_KEY` env-key cross-branch
   - C7: SQL injection en RPC

3. **Reglas duras del agente:**
   - NUNCA editar código.
   - NUNCA correr SQL que mute (solo `SELECT`, `EXPLAIN`).
   - NUNCA exponer secrets en el reporte (mask el valor, mostrá solo nombre de la env var).
   - SIEMPRE referenciar `archivo:línea` para que sea verificable.
   - SIEMPRE clasificar severidad (CRÍTICO / ALTO / MEDIO / BAJO) con criterio CVSS-like.
   - Si no puede probar el vector, lo baja a MEDIO o lo descarta a "Descartados".

### Bash restringido

| Permitido | Bloqueado |
|-----------|-----------|
| `npm audit`, `npm outdated` | `npm install`, `npm uninstall` |
| `git diff`, `git log`, `git show` | `git push`, `git commit`, `git checkout` |
| `gh pr view`, `gh pr diff`, `gh pr list` | `gh pr merge`, `gh pr close` |
| `grep`, `rg`, `ls`, `cat` | `rm`, `mv`, `chmod` |

Esto se complementa con allowlist en `.claude/settings.json` (sección 7).

---

## 5. Slash commands

### `/audit-fixes` — Validar hallazgos del informe existente

**Input:** ninguno (fuente fija: `docs/security/AUDITORIA_SEGURIDAD_PRE_MVP.md`).

**Algoritmo:**
1. Leer el informe, parsear los 41 hallazgos extrayendo: ID (C1, A1…), archivo, línea, fix sugerido.
2. Por cada hallazgo:
   - Leer el archivo actual.
   - Buscar el patrón vulnerable.
   - Decidir estado:
     - ✅ **RESUELTO** — fix aplicado.
     - 🟡 **PARCIAL** — hay cambios pero no cubren todo el vector.
     - ❌ **PENDIENTE** — sigue vulnerable.
     - ❓ **N/A** — el archivo cambió tanto que el hallazgo dejó de aplicar (con explicación).
3. Generar tabla resumen + detalle por hallazgo.

**Bash que usa:** `git log -p <file>` para ver fixes recientes.

### `/audit-full [--scope=<dominio>] [--save]` — Auditoría profunda

**Input:**
- `--scope` opcional: limita a un dominio (default: todos).
- `--save` opcional: persiste reporte en `docs/security/audit-YYYY-MM-DD.md`.

**8 dominios:**
1. **RLS policies** — recorrer tablas con `tenant_id`, verificar que ninguna policy permita cross-tenant.
2. **Edge Functions** — `verify_jwt`, validación de `tenant_id` server-side, rate-limit.
3. **Auth flows** — signup, password reset, MFA, session management.
4. **Secrets & env** — leak en repo, hardcoded keys, `.env*` en git.
5. **Frontend** — XSS (`dangerouslySetInnerHTML`), localStorage de tokens, CORS.
6. **Cabeceras HTTP** — CSP, HSTS, X-Frame-Options en Vercel.
7. **Dependencias** — `npm audit`, deps con CVE conocido.
8. **Endpoints Vercel** — `api/*.ts`, validación de input, auth.

Por cada dominio: lista de hallazgos con severidad, evidencia, fix sugerido.

**Bash que usa:** `npm audit --json`, MCP Supabase `get_advisors` y `list_migrations`.

### `/audit-diff [PR# | branch]` — Guardian de regresiones

**Input:**
- Sin args → `git diff main...HEAD`.
- `42` → `gh pr diff 42`.
- `feat/foo` → `git diff main...feat/foo`.

**Algoritmo:**
1. Obtener el diff.
2. Filtrar archivos sensibles (migrations, functions, AuthContext, services, api, package.json).
3. Por cada archivo, buscar patrones de regresión:
   - RLS policy nueva sin `tenant_id` en `WHERE` / `USING`.
   - Edge Function sin `verify_jwt: true` en `config.toml`.
   - `supabase.from(...)` directo desde componente (rompe convención del proyecto).
   - `console.log` con tokens / secrets.
   - `process.env.X` donde `X` es secret expuesto al cliente (`VITE_*` que no debería).
   - Dep agregada con CVE alto en `npm audit`.
4. Veredicto: **✅ APROBAR / 🟡 OBSERVACIONES / ❌ BLOQUEAR** + lista accionable.

**Bash que usa:** `git diff`, `gh pr diff`, `npm audit`.

**Latencia objetivo:** <60s para diffs <300 líneas (consistente con la regla de tamaño de PR del proyecto).

---

## 6. Formato de output

### Estructura común a los 3 modos

```markdown
# Security Audit — <modo> — <fecha>

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
- **Vector:** <descripción del ataque concreto>
- **Evidencia:** `<snippet de código que lo prueba>`
- **Fix sugerido:** <acción específica>
- **Refs:** <OWASP / CWE / CVE si aplica>

### [ALTO] <título corto>
...

## Descartados (con razón)
- <hallazgo X> — descartado porque <razón verificable>
```

### Diferencias por modo

| Modo | Bloque extra |
|------|--------------|
| `/audit-fixes` | Tabla por hallazgo con Estado (Resuelto/Parcial/Pendiente/N/A) y commit del fix si lo encontró |
| `/audit-full` | Sección por cada uno de los 8 dominios + cobertura (qué se revisó y qué no) |
| `/audit-diff` | Hunks específicos del diff que disparan cada hallazgo + sugerencia en formato `git diff` |

### Reglas estrictas del output

1. Cero severidad inflada. Si no se puede probar el vector → MEDIO o descartado.
2. Cada hallazgo es accionable. Nada de "revisar X". Siempre instrucciones específicas con archivo:línea.
3. Sin secrets en plano. `OPENAI_API_KEY=***`, no el valor.
4. Falsos positivos esperables se documentan al final en sección "Descartados (con razón)".

---

## 7. Settings

Allowlist mínima para `.claude/settings.json` (mergeada con la actual, no la reemplaza):

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
      "Bash(gh pr list:*)"
    ]
  }
}
```

---

## 8. Fuera de alcance (YAGNI)

- ❌ Fix automático de vulnerabilidades (decidido: read-only).
- ❌ Hook `PostToolUse` que dispare el agente sin OK del usuario (decidido: manual + sugería).
- ❌ Notificaciones a Slack / email.
- ❌ Integración con GitHub Actions (puede venir como PR aparte).
- ❌ Comparativa diff entre auditorías sucesivas (v2).
- ❌ Auditoría de `services/autofact-scraper/` (microservicio Python aislado, fuera del scope del repo principal).

---

## 9. Criterios de éxito

El agente está listo cuando:

1. ✅ Los 3 archivos existen: `.claude/agents/security-auditor.md`, `.claude/commands/audit-{fixes,full,diff}.md`.
2. ✅ `.claude/settings.json` tiene la allowlist Bash.
3. ✅ `/audit-fixes` corre y devuelve tabla con estado por hallazgo del informe.
4. ✅ `/audit-full` corre los 8 dominios y `--save` persiste a `docs/security/audit-<fecha>.md`.
5. ✅ `/audit-diff` revisa el diff actual en <60s y emite veredicto.
6. ✅ Smoke test: cada comando se invoca al menos una vez exitosamente sin tocar código.
7. ✅ El agente NUNCA aparece haciendo Edit/Write en logs de la sesión de prueba.

---

## 10. Plan de implementación (resumen para writing-plans)

Pasos atómicos para que el siguiente agente (writing-plans) los expanda:

1. Crear `.claude/agents/security-auditor.md` con frontmatter + prompt completo.
2. Crear `.claude/commands/audit-fixes.md`.
3. Crear `.claude/commands/audit-full.md` (con flag `--save`).
4. Crear `.claude/commands/audit-diff.md`.
5. Mergear allowlist Bash en `.claude/settings.json` (preservando lo existente).
6. Smoke test de los 3 comandos.
7. Documentar en `CLAUDE.md` sección 11 (workflow) la disponibilidad del agente.
8. Commit + draft PR siguiendo el workflow del proyecto.
