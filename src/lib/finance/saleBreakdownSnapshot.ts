/**
 * Puente entre la cascada pura y la persistencia (sale_breakdown).
 * Toma los insumos de la venta + los parámetros del tenant (con override por venta)
 * y devuelve la fila-snapshot lista para congelar. Sin Supabase.
 */
import {
  calcularCascada,
  type CascadaInsumos,
  type CascadaParametros,
  type SocioMonto,
  type SocioParametro,
} from "./saleCascade";

export interface CascadaSettings {
  comisionVentaDefault: number;
  comisionConsignadorDefault: number;
  pctGerencia: number;
  socios: SocioParametro[];
}

export interface SaleCascadeInput {
  precioTotal: number;
  pie?: number;
  precioConsignacion: number;
  gastoGeneral?: number;
  /** Override puntual del default del tenant. */
  comisionVenta?: number;
  /** Override puntual del default del tenant. */
  comisionConsignador?: number;
}

/** Snapshot congelado, en snake_case para mapear directo a la fila sale_breakdown. */
export interface SaleBreakdownSnapshot {
  precio_total: number;
  pie: number;
  precio_consignacion: number;
  gasto_general: number;
  comision_venta: number;
  comision_consignador: number;
  pct_gerencia: number;
  socios_params: SocioParametro[];
  saldo_precio: number;
  utilidad_bruta: number;
  gasto_total: number;
  utilidad_antes_gerencia: number;
  comision_gerencia: number;
  utilidad_post_gerencia: number;
  socios_montos: SocioMonto[];
  utilidad_final_miami: number;
}

export function construirSnapshot(
  input: SaleCascadeInput,
  settings: CascadaSettings,
): SaleBreakdownSnapshot {
  const comisionVenta = input.comisionVenta ?? settings.comisionVentaDefault;
  const comisionConsignador =
    input.comisionConsignador ?? settings.comisionConsignadorDefault;
  const pie = input.pie ?? 0;
  const gastoGeneral = input.gastoGeneral ?? 0;

  const parametros: CascadaParametros = {
    comisionVenta,
    comisionConsignador,
    pctGerencia: settings.pctGerencia,
    socios: settings.socios,
  };
  const insumos: CascadaInsumos = {
    precioTotal: input.precioTotal,
    pie,
    precioConsignacion: input.precioConsignacion,
    gastoGeneral,
  };

  const d = calcularCascada(insumos, parametros);

  return {
    precio_total: input.precioTotal,
    pie,
    precio_consignacion: input.precioConsignacion,
    gasto_general: gastoGeneral,
    comision_venta: comisionVenta,
    comision_consignador: comisionConsignador,
    pct_gerencia: settings.pctGerencia,
    socios_params: settings.socios,
    saldo_precio: d.saldoPrecio,
    utilidad_bruta: d.utilidadBruta,
    gasto_total: d.gastoTotal,
    utilidad_antes_gerencia: d.utilidadAntesGerencia,
    comision_gerencia: d.comisionGerencia,
    utilidad_post_gerencia: d.utilidadPostGerencia,
    socios_montos: d.socios,
    utilidad_final_miami: d.utilidadFinalMiami,
  };
}
