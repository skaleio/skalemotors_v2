# Cascada financiera por venta — Módulo puro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el cálculo puro de la cascada financiera por venta (`src/lib/finance/saleCascade.ts`) con tests, que produce la "Utilidad Final Miami" = el `margin` canónico.

**Architecture:** Funciones puras sin Supabase, mismo patrón que `src/lib/crmPipeline.ts`. Recibe insumos + parámetros (por tenant, sin nada hardcodeado) y devuelve el desglose completo. La Utilidad Final Miami absorbe el remanente de redondeo para que la cascada sume exacta (cero centavos fantasma). La persistencia (migración, snapshot, RLS) es un plan aparte.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-finanzas-cascada-venta-design.md`

---

## File Structure

- Create: `src/lib/finance/saleCascade.ts` — tipos + `calcularCascada()`. Única responsabilidad: la cascada (pasos 1-8 del spec).
- Create: `src/lib/finance/saleCascade.test.ts` — tests Vitest, incluido el caso real verificado.

No se toca ningún otro archivo en este plan. No hay imports de Supabase.

---

## Task 0: Worktree

- [ ] **Step 1: Crear worktree dedicado**

Run:
```bash
bash scripts/new-worktree.sh cascada-finanzas feat/finanzas-cascada-venta
```
Expected: worktree creado en `../skalemotors_v2-cascada-finanzas` en branch `feat/finanzas-cascada-venta`. Trabajar ahí el resto del plan.

- [ ] **Step 2: Crear PR draft tras el primer commit** (se hace después de Task 1)

Run (después del commit de Task 1):
```bash
gh pr create --draft --title "feat(finanzas): cascada por venta — módulo puro" --body "Módulo puro saleCascade.ts + tests. Spec: docs/superpowers/specs/2026-06-14-finanzas-cascada-venta-design.md"
```

---

## Task 1: Tipos + `calcularCascada` (caso real)

**Files:**
- Create: `src/lib/finance/saleCascade.ts`
- Test: `src/lib/finance/saleCascade.test.ts`

- [ ] **Step 1: Escribir el test que falla (caso real de la planilla)**

`src/lib/finance/saleCascade.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { calcularCascada, type CascadaParametros } from "./saleCascade";

const PARAMS_MIAMI: CascadaParametros = {
  comisionVenta: 200_000,
  comisionConsignador: 150_000,
  pctGerencia: 0.1,
  socios: [
    { nombre: "Antonio", pct: 0.03 },
    { nombre: "Juampi", pct: 0.03 },
    { nombre: "Leonardo", pct: 0.04 },
  ],
};

describe("calcularCascada", () => {
  it("reproduce el caso real de la planilla (utilidad final $1.174.500)", () => {
    // utilidadBruta 1.800.000 - gastoTotal 350.000 = antesGerencia 1.450.000
    const d = calcularCascada(
      {
        precioTotal: 10_000_000,
        pie: 2_000_000,
        precioConsignacion: 8_200_000,
        gastoGeneral: 0,
      },
      PARAMS_MIAMI,
    );

    expect(d.saldoPrecio).toBe(8_000_000);
    expect(d.utilidadBruta).toBe(1_800_000);
    expect(d.gastoTotal).toBe(350_000);
    expect(d.utilidadAntesGerencia).toBe(1_450_000);
    expect(d.comisionGerencia).toBe(145_000);
    expect(d.utilidadPostGerencia).toBe(1_305_000);
    expect(d.socios).toEqual([
      { nombre: "Antonio", monto: 39_150 },
      { nombre: "Juampi", monto: 39_150 },
      { nombre: "Leonardo", monto: 52_200 },
    ]);
    expect(d.utilidadFinalMiami).toBe(1_174_500);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/finance/saleCascade.test.ts`
Expected: FAIL — `calcularCascada` no existe (módulo no encontrado).

- [ ] **Step 3: Implementar el módulo**

`src/lib/finance/saleCascade.ts`:
```ts
/**
 * Cascada financiera por venta — única fuente de verdad del desglose.
 * Sin Supabase. Los parámetros vienen por tenant; nada hardcodeado.
 * Orden y reglas: docs/superpowers/specs/2026-06-14-finanzas-cascada-venta-design.md
 */

export interface SocioParametro {
  /** Nombre del socio (por tenant; ej. miami: Antonio/Juampi/Leonardo). */
  nombre: string;
  /** Fracción sobre la utilidad post gerencia (0.03 = 3%). */
  pct: number;
}

export interface CascadaParametros {
  /** Monto fijo de comisión de venta (vendedor). */
  comisionVenta: number;
  /** Monto fijo de comisión de consignador. */
  comisionConsignador: number;
  /** Fracción de gerencia sobre la utilidad antes de gerencia (0.1 = 10%). */
  pctGerencia: number;
  /** Reparto de socios sobre la utilidad post gerencia. */
  socios: SocioParametro[];
}

export interface CascadaInsumos {
  precioTotal: number;
  pie: number;
  precioConsignacion: number;
  gastoGeneral: number;
}

export interface SocioMonto {
  nombre: string;
  monto: number;
}

export interface CascadaDesglose {
  saldoPrecio: number;
  utilidadBruta: number;
  gastoTotal: number;
  utilidadAntesGerencia: number;
  comisionGerencia: number;
  utilidadPostGerencia: number;
  socios: SocioMonto[];
  /** El 90% restante: lo que queda para la empresa. Es el `margin` canónico. */
  utilidadFinalMiami: number;
}

export function calcularCascada(
  insumos: CascadaInsumos,
  parametros: CascadaParametros,
): CascadaDesglose {
  const saldoPrecio = insumos.precioTotal - insumos.pie;
  const utilidadBruta = insumos.precioTotal - insumos.precioConsignacion;
  const gastoTotal =
    parametros.comisionVenta +
    parametros.comisionConsignador +
    insumos.gastoGeneral;
  const utilidadAntesGerencia = utilidadBruta - gastoTotal;
  const comisionGerencia = Math.round(
    utilidadAntesGerencia * parametros.pctGerencia,
  );
  const utilidadPostGerencia = utilidadAntesGerencia - comisionGerencia;

  const socios = parametros.socios.map((s) => ({
    nombre: s.nombre,
    monto: Math.round(utilidadPostGerencia * s.pct),
  }));

  const totalSocios = socios.reduce((sum, s) => sum + s.monto, 0);
  // Miami absorbe el remanente de redondeo: la cascada suma exacta.
  const utilidadFinalMiami = utilidadPostGerencia - totalSocios;

  return {
    saldoPrecio,
    utilidadBruta,
    gastoTotal,
    utilidadAntesGerencia,
    comisionGerencia,
    utilidadPostGerencia,
    socios,
    utilidadFinalMiami,
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/finance/saleCascade.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/finance/saleCascade.ts src/lib/finance/saleCascade.test.ts
git commit -m "feat(finanzas): cascada por venta — modulo puro con caso real verificado"
```

Tras este commit, crear el PR draft (Task 0, Step 2).

---

## Task 2: Tests de parámetros (override, multi-tenant, redondeo)

**Files:**
- Modify: `src/lib/finance/saleCascade.test.ts`

- [ ] **Step 1: Agregar los tests que faltan**

Agregar dentro del `describe("calcularCascada", ...)` en `src/lib/finance/saleCascade.test.ts`:
```ts
  it("respeta un override de comisión de venta sobre el default del tenant", () => {
    const d = calcularCascada(
      {
        precioTotal: 10_000_000,
        pie: 2_000_000,
        precioConsignacion: 8_200_000,
        gastoGeneral: 0,
      },
      { ...PARAMS_MIAMI, comisionVenta: 300_000 },
    );
    // gastoTotal 450.000 → antesGerencia 1.350.000
    expect(d.gastoTotal).toBe(450_000);
    expect(d.utilidadAntesGerencia).toBe(1_350_000);
  });

  it("los socios suman 10% de post gerencia y Miami queda con el 90%", () => {
    const d = calcularCascada(
      {
        precioTotal: 10_000_000,
        pie: 0,
        precioConsignacion: 8_200_000,
        gastoGeneral: 0,
      },
      PARAMS_MIAMI,
    );
    const totalSocios = d.socios.reduce((s, x) => s + x.monto, 0);
    expect(totalSocios + d.utilidadFinalMiami).toBe(d.utilidadPostGerencia);
  });

  it("funciona para otro tenant con socios y porcentajes distintos, sin nada hardcodeado", () => {
    const params: CascadaParametros = {
      comisionVenta: 100_000,
      comisionConsignador: 80_000,
      pctGerencia: 0.12,
      socios: [
        { nombre: "Socia A", pct: 0.05 },
        { nombre: "Socio B", pct: 0.05 },
      ],
    };
    const d = calcularCascada(
      {
        precioTotal: 5_000_000,
        pie: 1_000_000,
        precioConsignacion: 4_000_000,
        gastoGeneral: 20_000,
      },
      params,
    );
    expect(d.socios.map((s) => s.nombre)).toEqual(["Socia A", "Socio B"]);
    const totalSocios = d.socios.reduce((s, x) => s + x.monto, 0);
    expect(totalSocios + d.utilidadFinalMiami).toBe(d.utilidadPostGerencia);
  });

  it("la cascada suma exacta aunque haya redondeo (Miami absorbe el remanente)", () => {
    const d = calcularCascada(
      {
        precioTotal: 7_777_777,
        pie: 1_111_111,
        precioConsignacion: 5_555_555,
        gastoGeneral: 33_333,
      },
      PARAMS_MIAMI,
    );
    const totalSocios = d.socios.reduce((s, x) => s + x.monto, 0);
    expect(d.comisionGerencia + d.utilidadPostGerencia).toBe(
      d.utilidadAntesGerencia,
    );
    expect(totalSocios + d.utilidadFinalMiami).toBe(d.utilidadPostGerencia);
    expect(Number.isInteger(d.utilidadFinalMiami)).toBe(true);
  });
```

- [ ] **Step 2: Correr los tests para verificar que pasan**

Run: `npx vitest run src/lib/finance/saleCascade.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add src/lib/finance/saleCascade.test.ts
git commit -m "test(finanzas): cascada — override, multi-tenant y redondeo exacto"
```

---

## Task 3: Validación final y PR ready

- [ ] **Step 1: Lint + build + test completo**

Run:
```bash
npm run lint && npm run build && npm run test
```
Expected: los tres en verde. (El módulo es puro y no toca imports existentes, no debería romper nada.)

- [ ] **Step 2: Pasar el PR a ready**

Run:
```bash
gh pr ready
```
Expected: el PR draft pasa a ready para revisión humana. Merge lo hace el humano.

---

## Notas para el siguiente plan (#A persistencia)

Fuera de alcance de este plan, va en `docs/superpowers/plans/2026-06-14-finanzas-cascada-persistencia.md`:
- Migración: tabla `sale_breakdown` (snapshot 1:1 con la venta) + `tenant_finance_config` (parámetros por tenant).
- RLS por `tenant_id` (correr `get_advisors` antes de aplicar, pedir OK a Antonio).
- Servicio + integración: al cerrar la venta, calcular con `calcularCascada` y congelar snapshot; `margin = utilidadFinalMiami`.
- Regenerar `src/lib/types/database.ts`.
- Backfill de `sale_id` en ingresos manuales (habilita dedup de #1).
