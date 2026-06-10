-- Vendedor: leads asignados explícitamente (assigned_to) visibles aunque branch_id difiera.
-- Evita ciego CRM cuando admin delega leads de otra sucursal.
-- Leads propios sin asignar siguen acotados a la sucursal del vendedor.

CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.users WHERE id = auth.uid() LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_user_branch_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_branch_id() TO authenticated;

DROP POLICY IF EXISTS leads_select_auth ON public.leads;
CREATE POLICY leads_select_auth ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND tenant_id = public.current_tenant_id()
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND tenant_id = public.current_tenant_id()
      AND (
        assigned_to = auth.uid()
        OR (
          created_by = auth.uid()
          AND assigned_to IS NULL
          AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS leads_update_auth ON public.leads;
CREATE POLICY leads_update_auth ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND tenant_id = public.current_tenant_id()
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND tenant_id = public.current_tenant_id()
      AND (
        assigned_to = auth.uid()
        OR (
          created_by = auth.uid()
          AND assigned_to IS NULL
          AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
        )
      )
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND tenant_id = public.current_tenant_id()
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND tenant_id = public.current_tenant_id()
      AND (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );

DROP POLICY IF EXISTS leads_delete_auth ON public.leads;
CREATE POLICY leads_delete_auth ON public.leads
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND tenant_id = public.current_tenant_id()
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND tenant_id = public.current_tenant_id()
      AND (
        assigned_to = auth.uid()
        OR (
          created_by = auth.uid()
          AND assigned_to IS NULL
          AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
        )
      )
    )
  );
