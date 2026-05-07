-- M1: Reemplaza la policy permisiva USING(true) por filtro tenant explícito.
-- La restrictive policy ya enforce tenant, pero USING(true) es código confuso
-- y peligroso si alguien remueve la restrictive en el futuro.

DROP POLICY IF EXISTS branch_sales_staff_select ON public.branch_sales_staff;
CREATE POLICY branch_sales_staff_select ON public.branch_sales_staff
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );
