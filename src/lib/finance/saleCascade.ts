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
