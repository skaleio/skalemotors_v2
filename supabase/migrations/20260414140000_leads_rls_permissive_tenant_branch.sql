-- ============================================================================
-- Corrige políticas permisivas de public.leads (post 20260810130000).
-- El INSERT solo permitía tenant_id = current_tenant_id(); si el cliente
-- envía branch_id pero no tenant_id (NULL), el CHECK fallaba aunque la
-- política restrictiva tenant_restrict_leads sí permitía la fila.
-- Alineamos SELECT/INSERT/UPDATE/DELETE con la misma lógica que la restrictiva.
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
  );

CREATE POLICY leads_insert_auth ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
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
  );

CREATE POLICY leads_update_auth ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
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
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
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
  );

CREATE POLICY leads_delete_auth ON public.leads
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
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
  );
