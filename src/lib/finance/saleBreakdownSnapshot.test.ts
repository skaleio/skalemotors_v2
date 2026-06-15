import { describe, expect, it } from "vitest";
import { construirSnapshot, type CascadaSettings } from "./saleBreakdownSnapshot";

const SETTINGS_MIAMI: CascadaSettings = {
  comisionVentaDefault: 200_000,
  comisionConsignadorDefault: 150_000,
  pctGerencia: 0.1,
  socios: [
    { nombre: "Antonio", pct: 0.03 },
    { nombre: "Juampi", pct: 0.03 },
    { nombre: "Leonardo", pct: 0.04 },
  ],
};

describe("construirSnapshot", () => {
  it("arma el snapshot del caso real (utilidad_final_miami $1.174.500)", () => {
    const s = construirSnapshot(
      {
        precioTotal: 10_000_000,
        pie: 2_000_000,
        precioConsignacion: 8_200_000,
        gastoGeneral: 0,
      },
      SETTINGS_MIAMI,
    );

    expect(s.comision_venta).toBe(200_000);
    expect(s.comision_consignador).toBe(150_000);
    expect(s.utilidad_antes_gerencia).toBe(1_450_000);
    expect(s.comision_gerencia).toBe(145_000);
    expect(s.utilidad_post_gerencia).toBe(1_305_000);
    expect(s.socios_montos).toEqual([
      { nombre: "Antonio", monto: 39_150 },
      { nombre: "Juampi", monto: 39_150 },
      { nombre: "Leonardo", monto: 52_200 },
    ]);
    expect(s.utilidad_final_miami).toBe(1_174_500);
  });

  it("usa los defaults del tenant cuando la venta no trae override", () => {
    const s = construirSnapshot(
      { precioTotal: 5_000_000, precioConsignacion: 4_000_000 },
      SETTINGS_MIAMI,
    );
    expect(s.comision_venta).toBe(200_000);
    expect(s.comision_consignador).toBe(150_000);
    expect(s.pie).toBe(0);
    expect(s.gasto_general).toBe(0);
  });

  it("respeta el override de comisión por venta sobre el default", () => {
    const s = construirSnapshot(
      {
        precioTotal: 10_000_000,
        precioConsignacion: 8_200_000,
        comisionVenta: 300_000,
      },
      SETTINGS_MIAMI,
    );
    expect(s.comision_venta).toBe(300_000);
    expect(s.gasto_total).toBe(450_000);
  });

  it("congela los parámetros usados junto a los montos", () => {
    const s = construirSnapshot(
      { precioTotal: 10_000_000, precioConsignacion: 8_200_000 },
      SETTINGS_MIAMI,
    );
    expect(s.pct_gerencia).toBe(0.1);
    expect(s.socios_params).toEqual(SETTINGS_MIAMI.socios);
  });
});
