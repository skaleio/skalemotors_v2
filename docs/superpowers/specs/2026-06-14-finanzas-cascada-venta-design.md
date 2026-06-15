# Cascada financiera por venta (Skale Motors v2)

**Fecha:** 2026-06-14
**Estado:** Diseño aprobado — sub-proyecto #A (fundacional) del plan de finanzas
**Autor:** brainstorming con Antonio
**Relacionado:** `2026-06-14-finanzas-logica-canonica-design.md` (#1), skill `ventas-miami-financiero`

## Problema

El negocio reparte cada venta en una cascada fija (verificada en la planilla real, fila por fila): comisión de venta y de consignador (montos fijos), comisión de gerencia (10%), reparto de socios (Antonio 3% / Juampi 3% / Leonardo 4%) y "Utilidad Final Miami" (90% restante). Hoy la app **no** modela nada de esto: la tabla `sales` solo guarda `sale_price, margin, commission, status`. El desglose vive en una planilla externa, a mano, fuera del sistema.

Consecuencia: `margin` (lo que cada venta aporta a Finanzas) es un número cargado a mano sin trazabilidad. Por eso los totales no son auditables ni confiables. Son finanzas reales (millones de CLP): el cálculo tiene que ser exacto, congelado y reproducible.

## Objetivo

Que la app **calcule la cascada por venta**, con parámetros configurables por tenant, y que el resultado (**Utilidad Final Miami**) sea el `margin` canónico que alimenta el balance (#1). Define qué es `margin`.

## Modelo de negocio (la cascada — orden obligatorio)

Calca la skill `ventas-miami-financiero`:

1. Saldo precio = Precio total − Pie
2. Utilidad bruta = Precio total − Precio consignación
3. Gasto total = Comisión venta + Comisión consignador + Gasto general
4. Utilidad antes de gerencia = Utilidad bruta − Gasto total
5. Comisión gerencia = Utilidad antes de gerencia × % gerencia
6. Utilidad post gerencia = Utilidad antes de gerencia − Comisión gerencia
7. Antonio = post gerencia × % Antonio; Juampi = × % Juampi; Leonardo = × % Leonardo
8. **Utilidad Final Miami** = post gerencia − Antonio − Juampi − Leonardo

Verificación obligatoria (caso real): Utilidad antes de gerencia $1.450.000 → gerencia $145.000 → post $1.305.000 → Antonio $39.150 → **Utilidad Final $1.174.500**.

## Decisiones tomadas

1. **Origen de la venta: híbrido.** La venta nace en CRM (lead → negocio concretado → formulario: cliente, vehículo, precio). Los insumos financieros (precio consignación, comisiones, gasto general) se completan en el módulo de Ventas.

2. **Parámetros por tenant, sobreescribibles por venta.** Los montos fijos (comisión venta $200.000 / consignador $150.000), los % (gerencia 10%, Antonio 3%, Juampi 3%, Leonardo 4%) **y los nombres de socios** son configuración del tenant — NO se hardcodean (Antonio/Juampi/Leonardo son de miami motors, no del SaaS, misma lección que el string `"hessenmotors"`). Cada venta puede sobreescribir un valor puntual (ej. comisión venta $300.000 en la #10).

3. **Snapshot congelado al cerrar.** Al cerrar la venta se guardan los montos calculados **y** los parámetros usados. Cambiar un parámetro después NO reescribe ventas pasadas. Botón explícito "recalcular esta venta" solo para corregir errores de carga. Es lo contablemente correcto y auditable.

4. **Aporte al balance = Utilidad Final Miami (neta).** El balance (#1) suma la Utilidad Final Miami, que ya tiene descontadas comisiones + gerencia + socios dentro de la cascada. Esas comisiones **NO** se cargan además como gastos sueltos → cero doble conteo. `margin` de la venta = Utilidad Final Miami.

## Arquitectura

### Módulo puro (sin Supabase, testeable)

`src/lib/finance/saleCascade.ts` — patrón `crmPipeline.ts`:

- `calcularCascada(insumos, parametros) → desglose` — la cascada completa (pasos 1-8). Funciones puras, sin fetch, sin estado.
- `parametros`: montos fijos + % + nombres de socios (vienen de la config del tenant o del override de la venta).
- `desglose`: todos los intermedios (saldo, utilidad bruta, gasto total, antes/post gerencia, cada socio) + Utilidad Final Miami.

`src/lib/finance/saleCascade.test.ts` — casos obligatorios:
- Caso real venta #2 ($1.450.000 → $1.174.500) exacto.
- Override por venta (comisión venta $300.000) se respeta sobre el default del tenant.
- Socios suman 10% de post gerencia; Miami queda con 90%.
- Parámetros distintos (otro tenant, otros nombres/%) → la cascada funciona sin nada hardcodeado.

### Persistencia

Extender el modelo de venta para guardar insumos + snapshot del desglose + snapshot de parámetros. **Decisión abierta para el plan:** columnas nuevas en `sales` vs. tabla `sale_breakdown` (1:1). Recomendación inicial: tabla `sale_breakdown` para no inflar `sales` y aislar el snapshot.

Requisitos:
- Migración nueva `supabase/migrations/YYYYMMDDHHMMSS_*.sql` (nunca editar aplicadas).
- `margin` de la venta = Utilidad Final Miami del snapshot.
- Config de parámetros por tenant (comparte mecanismo con el flag `es_empresa` de #1 — evaluar tabla `tenant_finance_config` común).
- RLS por `tenant_id`; nunca confiar en `tenant_id` del cliente.
- Tocar schema → regenerar `src/lib/types/database.ts`.

### Flujo

- CRM crea la venta con datos básicos al concretar el lead.
- En Ventas se completan los insumos financieros; al "cerrar" la venta se calcula la cascada y se congela el snapshot.
- "Cerrar venta" = transición de estado explícita (definir el estado exacto en el plan; hoy `status` existe en `sales`).

## Fuera de alcance

- Pipeline CRM→Ventas detallado (qué campos exactos viajan del lead a la venta) — dependencia, se especifica al integrar.
- Export/import de planilla .xlsx al software Scala Motors — feature aparte (la skill `ventas-miami-financiero` la cubre como capacidad futura).
- Panel de edición de parámetros (UI) — puede ser sub-proyecto propio; #A entrega el modelo + la config base.

## Criterios de aceptación

1. `src/lib/finance/saleCascade.ts` + test, todos pasando, con el caso real verificado.
2. Cero nombres/montos hardcodeados: todo sale de parámetros por tenant.
3. Migración aplicada: persistencia de insumos + snapshot + parámetros; tipos regenerados.
4. `margin` de una venta cerrada = Utilidad Final Miami del snapshot.
5. Recalcular un parámetro del tenant NO altera ventas ya cerradas.
6. `npm run test` en verde.

## Workflow

Worktree dedicado + PR draft desde el primer commit. Branch `feat/finanzas-cascada-venta`. Migración/RLS pasan por `get_advisors` antes de aplicar. PR ≤ ~300 líneas; si excede, encadenar (módulo puro + tests primero, persistencia después).
