-- Pool de delegación CEO: vendedores solo ven leads asignados o propios sin asignar.
-- Leads creados por admin/jefe en NUEVO sin assigned_to quedan visibles solo para roles de supervisión.

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
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
      AND (
        assigned_to = auth.uid()
        OR (created_by = auth.uid() AND assigned_to IS NULL)
      )
    )
  );

DROP POLICY IF EXISTS leads_insert_auth ON public.leads;
CREATE POLICY leads_insert_auth ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND tenant_id = public.current_tenant_id()
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND tenant_id = public.current_tenant_id()
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
      AND (assigned_to IS NULL OR assigned_to = auth.uid())
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
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
      AND (
        assigned_to = auth.uid()
        OR (created_by = auth.uid() AND assigned_to IS NULL)
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
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
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
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
      AND (
        assigned_to = auth.uid()
        OR (created_by = auth.uid() AND assigned_to IS NULL)
      )
    )
  );
