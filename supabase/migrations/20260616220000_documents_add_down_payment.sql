-- Pie/abono inicial de la Nota de Venta (Miami Motors muestra PIE + saldo restante).
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS down_payment numeric;

COMMENT ON COLUMN public.documents.down_payment IS 'Monto del pie/abono en una nota de venta; el saldo restante se calcula como sale_price - down_payment.';
