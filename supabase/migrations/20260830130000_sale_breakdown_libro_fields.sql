-- Campos de presentación/cobranza del Libro de Ventas (no afectan la cascada).
-- primer_pago / pago_final = seguimiento de cobranza (NO entran al cálculo de utilidad).
-- consignador_nombre = nombre del consignador (texto del libro).
-- numero_venta = N° correlativo del libro por tenant.

ALTER TABLE public.sale_breakdown
  ADD COLUMN IF NOT EXISTS numero_venta integer,
  ADD COLUMN IF NOT EXISTS primer_pago numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pago_final numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consignador_nombre text;

COMMENT ON COLUMN public.sale_breakdown.primer_pago IS 'Cobranza: primer pago. Seguimiento, NO entra al cálculo de utilidad.';
COMMENT ON COLUMN public.sale_breakdown.pago_final IS 'Cobranza: pago final. Seguimiento, NO entra al cálculo de utilidad.';
COMMENT ON COLUMN public.sale_breakdown.consignador_nombre IS 'Nombre del consignador (texto del Libro de Ventas).';
COMMENT ON COLUMN public.sale_breakdown.numero_venta IS 'N° correlativo del Libro de Ventas por tenant.';
