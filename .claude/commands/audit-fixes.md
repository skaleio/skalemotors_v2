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
