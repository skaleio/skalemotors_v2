-- Performance fix: advisor multiple_permissive_policies
-- Cuando una tabla tiene varias permissive policies para el mismo (role, command),
-- Postgres las evalua TODAS en OR para cada query. Consolidamos.
--
-- branch_sales_staff SELECT: branch_sales_staff_select y _select_tenant son
--   identicas (legacy duplicate). Dejamos solo branch_sales_staff_select.
--
-- consignaciones DELETE/INSERT/UPDATE: hay una policy "con sucursal" y otra
--   "sin sucursal" para cada comando. Las mergeamos en una sola con OR.

-- 1. branch_sales_staff
DROP POLICY IF EXISTS branch_sales_staff_select_tenant ON public.branch_sales_staff;

-- 2. consignaciones DELETE
DROP POLICY IF EXISTS "Consignaciones delete" ON public.consignaciones;
DROP POLICY IF EXISTS "Consignaciones delete sin sucursal" ON public.consignaciones;
CREATE POLICY consignaciones_delete ON public.consignaciones
  FOR DELETE TO authenticated
  USING (
    (branch_id IS NULL AND created_by = (SELECT auth.uid()))
    OR (branch_id IN (
      SELECT users.branch_id FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.branch_id IS NOT NULL
    ))
  );

-- 3. consignaciones INSERT
DROP POLICY IF EXISTS "Consignaciones insert" ON public.consignaciones;
DROP POLICY IF EXISTS "Consignaciones insert sin sucursal" ON public.consignaciones;
CREATE POLICY consignaciones_insert ON public.consignaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    branch_id IS NULL
    OR (branch_id IN (
      SELECT users.branch_id FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.branch_id IS NOT NULL
    ))
  );

-- 4. consignaciones UPDATE
DROP POLICY IF EXISTS "Consignaciones update" ON public.consignaciones;
DROP POLICY IF EXISTS "Consignaciones update sin sucursal" ON public.consignaciones;
CREATE POLICY consignaciones_update ON public.consignaciones
  FOR UPDATE TO authenticated
  USING (
    (branch_id IS NULL AND created_by = (SELECT auth.uid()))
    OR (branch_id IN (
      SELECT users.branch_id FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.branch_id IS NOT NULL
    ))
  )
  WITH CHECK (
    (branch_id IS NULL AND created_by = (SELECT auth.uid()))
    OR (branch_id IN (
      SELECT users.branch_id FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.branch_id IS NOT NULL
    ))
  );
