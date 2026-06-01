-- ============================================================================
-- C7 (complemento): expense_types — habilitar RLS y SELECT controlado.
-- Catálogo global de etiquetas: lectura para authenticated;
-- INSERT/UPDATE/DELETE ya restringidos en 20260511162428 / 20260810120000.
-- ============================================================================

ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_types_select_authenticated ON public.expense_types;
CREATE POLICY expense_types_select_authenticated ON public.expense_types
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE public.expense_types IS
  'Catálogo global de tipos de gasto. RLS: SELECT authenticated; mutaciones solo admin/jefe_jefe.';
