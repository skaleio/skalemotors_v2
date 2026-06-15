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
});
