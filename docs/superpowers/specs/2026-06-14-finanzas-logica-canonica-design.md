# Lógica financiera canónica — Dashboard de Finanzas (Skale Motors v2)

**Fecha:** 2026-06-14
**Estado:** Diseño aprobado — sub-proyecto #1 de 3
**Autor:** brainstorming con Antonio

## Problema

Los números del dashboard de finanzas no coinciden entre pantallas. El **balance se calcula en 3 lugares con fórmulas divergentes**:

- `src/pages/Finance.tsx:556` — solo resta gastos cuyo `inversor_name === "hessenmotors"`.
- `src/hooks/useDashboardStats.ts:244` — resta **todos** los gastos.
- `src/hooks/useBalanceByMonth.ts:93` — solo `hessenmotors`, con query aparte.

Causas raíz:

1. **`"hessenmotors"` es un string legacy hardcodeado.** HessenMotors es una automotora muerta. El tenant actual es "miami motors" y cada cliente futuro tendrá su propio nombre. Para cualquier tenant ≠ HessenMotors ese match no devuelve nada → el balance queda mal.
2. **Las ventas suman al balance en unos archivos y en otros no** (`Finance.tsx` no las suma; `useDashboardStats`/`useFundManagement` sí), con deduplicación heurística por `fecha|monto`.
3. **`payment_status` NULL a veces cuenta como pagado.**
4. **No existe ningún módulo puro testeable** para finanzas (a diferencia de `crmPipeline.ts`, `leadContactState.ts`). Cada pantalla recalcula inline con `.reduce`.

Son finanzas reales (millones de CLP). La exigencia es: números exactos, trazables, sin "fantasmas", e idénticos entre pantallas por construcción.

## Alcance de este spec (#1)

Definir e implementar la **lógica financiera canónica** como módulo puro tenant-aware + la migración de datos que la habilita. **No** toca la UI ni refactoriza los consumidores todavía (eso es #2).

### Fuera de alcance

- **#2 Refactor a fuente única** — que `Finance.tsx`, `useDashboardStats`, `useBalanceByMonth` consuman este módulo. Spec aparte.
- **#3 Checker de reconciliación** — test/panel que falle si dos pantallas discrepan. Spec aparte.
- **Pipeline CRM→Ventas** (qué campos viajan del lead concretado a la venta). Dependencia externa, no se construye acá.
- **Pozo/Ahorro y reparto de socios por %.** Son artefactos de **un solo tenant** (legacy), no del SaaS. El módulo canónico NO los conoce ni los calcula; solo garantiza que **no contaminen el balance corriente**. Sus features de UI quedan como están.

## Modelo canónico (reglas de negocio — la "verdad")

1. **Caja-empresa.** Cada tenant tiene exactamente un "inversor" marcado como la caja de la empresa (flag explícito `es_empresa`). Reemplaza el match por string `"hessenmotors"`. Inversores externos (Jota, Mike, Ronald…) nunca se confunden con la caja.

2. **Ingresos** = `margin` de cada **venta concretada** **+** ingresos manuales (`ingresos_empresa`) que **no** sean duplicado de una venta. Cada peso se cuenta **una sola vez**. El `margin` de una venta lo define el sub-proyecto **#A** (cascada por venta) = **Utilidad Final Miami** del snapshot congelado — ver `2026-06-14-finanzas-cascada-venta-design.md`.

3. **Gastos que restan al balance** = solo los financiados por la caja-empresa (regla 1). Los de inversores externos se trackean aparte (cuánto aportó cada uno); **no restan** al balance.

4. **Balance** = Σ ingresos *realizados* − Σ gastos-empresa *realizados*.

5. **Estado de pago vacío.** `payment_status` NULL = **pendiente** (no cobrado). No suma a "ganancias reales" hasta marcarse pagado. Conservador; baja algunos totales hoy inflados.

6. **Deduplicación venta↔ingreso manual** por **vínculo `sale_id`** (la venta y su ingreso son el mismo dinero), no por heurística `fecha|monto` (falla con dos ventas idénticas el mismo día).

## Arquitectura

Nuevo directorio `src/lib/finance/` — funciones puras, sin Supabase, 100% testeables. Mismo patrón que `src/lib/crmPipeline.ts` + `crmPipeline.test.ts`.

Las funciones reciben datos ya cargados (arrays de ventas, gastos, ingresos, y la identidad de la caja-empresa) y devuelven números. No hacen fetch.

### Módulos propuestos

| Archivo | Responsabilidad | Test |
|---------|-----------------|------|
| `src/lib/finance/companyCash.ts` | `esCajaEmpresa(gasto, cajaEmpresaRef)` → bool. Encapsula la regla 1. Reemplaza `gastoAfectaBalance()`. | `companyCash.test.ts` |
| `src/lib/finance/income.ts` | `calcularIngresos(ventas, ingresosManuales, opts)` → total + desglose. Reglas 2, 5, 6 (dedup por `sale_id`, NULL=pendiente). | `income.test.ts` |
| `src/lib/finance/expenses.ts` | `calcularGastosEmpresa(gastos, cajaEmpresaRef, opts)` → total que resta (regla 3, 5). | `expenses.test.ts` |
| `src/lib/finance/balance.ts` | `calcularBalance({ingresos, gastosEmpresa})` → balance (regla 4). Orquesta los anteriores. | `balance.test.ts` |
| `src/lib/finance/types.ts` | Tipos de entrada/salida compartidos (sin acoplarse a `database.ts`). | — |

### Estados de pago (canónico)

Un único helper `estaRealizado(payment_status): boolean` → `payment_status === "realizado"`. Todo lo demás (incluido NULL, "pendiente", "") = no realizado. Cero ambigüedad, un solo lugar.

## Migración de datos (flag `es_empresa`)

**Decisión de implementación abierta — resolver en el plan:** hoy un gasto referencia a su inversor por **dos vías**: `inversor_id` (FK a `users`) **y** `inversor_name` (texto libre, donde vivía "HessenMotors"). La caja-empresa histórica era un *nombre*, no un usuario.

Opción recomendada para evaluar en el plan:

- Tabla de config por tenant (p. ej. `tenant_finance_config`) con el identificador de la caja-empresa (sea `inversor_id` o un `inversor_name` canónico), **o**
- Columna `es_empresa boolean` en la entidad de inversores correspondiente.

Requisitos de la migración, sea cual sea la forma:

- Nueva migración `supabase/migrations/YYYYMMDDHHMMSS_*.sql` (nunca editar aplicadas).
- Setear la caja-empresa del tenant **miami motors**.
- RLS: el flag/config es por `tenant_id`; nunca confiar en `tenant_id` del cliente.
- Si se toca schema → regenerar `src/lib/types/database.ts`.
- Backfill: vincular ingresos manuales existentes con su `sale_id` donde sea posible (habilita la regla 6); documentar cuántos quedan sin vincular.

## Testing

Cada módulo de `src/lib/finance/` con su `.test.ts`. Casos obligatorios:

- Gasto de inversor externo **no** resta; gasto de la caja-empresa **sí**.
- Venta con `payment_status` NULL **no** cuenta como realizada.
- Venta + ingreso manual con mismo `sale_id` se cuentan **una vez**.
- Dos ventas idénticas (mismo monto y fecha) sin vínculo **no** se colapsan erróneamente.
- Tenant ≠ "miami motors": la lógica funciona sin ningún string hardcodeado.
- Balance = ingresos realizados − gastos-empresa realizados, con números chicos verificables a mano.

`npm run test` en verde antes de cerrar el sub-proyecto.

## Criterios de aceptación

1. Existe `src/lib/finance/` con las funciones puras y sus tests, todos pasando.
2. Cero strings de tenant hardcodeados (`"hessenmotors"`) en la nueva lógica.
3. Migración aplicada que marca la caja-empresa de miami motors; tipos regenerados.
4. El módulo es consumible por los 3 callers (firma estable), pero los callers **aún no** se modifican (eso es #2).
5. La lógica respeta las 6 reglas canónicas y está documentada en los tests.

## Workflow

Worktree dedicado + PR draft desde el primer commit (regla del repo). Branch `feat/finanzas-logica-canonica`. La migración y cualquier cambio de RLS pasan por `get_advisors` antes de aplicar. PR ≤ ~300 líneas; si excede, encadenar.
