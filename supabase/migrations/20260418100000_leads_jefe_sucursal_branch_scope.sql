-- ============================================================================
-- Jefe de sucursal: solo leads de SU sucursal (misma branch_id que el perfil).
-- Admin, jefe_jefe, gerente, financiero, etc. siguen viendo todo el tenant según
-- la cláusula amplia. Vendedor sin cambios.
-- ============================================================================

DROP POLICY IF EXISTS leads_select_auth ON public.leads;
DROP POLICY IF EXISTS leads_insert_auth ON public.leads;
DROP POLICY IF EXISTS leads_update_auth ON public.leads;
DROP POLICY IF EXISTS leads_delete_auth ON public.leads;

CREATE POLICY leads_select_auth ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() = 'jefe_sucursal'
      AND (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()) IS NOT NULL
      AND branch_id IS NOT DISTINCT FROM (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid())
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND public.current_user_role() IS DISTINCT FROM 'jefe_sucursal'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
    )
  );

CREATE POLICY leads_insert_auth ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() = 'jefe_sucursal'
      AND (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()) IS NOT NULL
      AND branch_id IS NOT DISTINCT FROM (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid())
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND public.current_user_role() IS DISTINCT FROM 'jefe_sucursal'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
      AND (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );

CREATE POLICY leads_update_auth ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() = 'jefe_sucursal'
      AND (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()) IS NOT NULL
      AND branch_id IS NOT DISTINCT FROM (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid())
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND public.current_user_role() IS DISTINCT FROM 'jefe_sucursal'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() = 'jefe_sucursal'
      AND (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()) IS NOT NULL
      AND branch_id IS NOT DISTINCT FROM (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid())
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND public.current_user_role() IS DISTINCT FROM 'jefe_sucursal'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
      AND (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );

CREATE POLICY leads_delete_auth ON public.leads
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() = 'jefe_sucursal'
      AND (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()) IS NOT NULL
      AND branch_id IS NOT DISTINCT FROM (SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid())
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND public.current_user_role() IS DISTINCT FROM 'jefe_sucursal'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
    )
  );
