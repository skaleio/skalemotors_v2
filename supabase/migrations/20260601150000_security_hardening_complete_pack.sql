-- ============================================================================
-- Pack completo: H2 branch filters, M1 branch_sales_staff, chileautos listings
-- ============================================================================

-- H2: ai_usage_logs — branch del usuario debe pertenecer al tenant actual
DROP POLICY IF EXISTS ai_usage_logs_select ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_select ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR branch_id IN (
      SELECT u.branch_id FROM public.users u
      WHERE u.id = auth.uid()
        AND u.branch_id IS NOT NULL
        AND u.branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id())
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = public.current_tenant_id()
      )
    )
  );

-- H2: ai_branch_brain
DROP POLICY IF EXISTS ai_branch_brain_select ON public.ai_branch_brain;
CREATE POLICY ai_branch_brain_select ON public.ai_branch_brain FOR SELECT TO authenticated
  USING (
    branch_id IN (
      SELECT u.branch_id FROM public.users u
      WHERE u.id = auth.uid()
        AND u.branch_id IS NOT NULL
        AND u.branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id())
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = public.current_tenant_id()
      )
    )
  );

-- H2: chileautos_saved_listings
DROP POLICY IF EXISTS chileautos_saved_select ON public.chileautos_saved_listings;
CREATE POLICY chileautos_saved_select ON public.chileautos_saved_listings
  FOR SELECT TO authenticated
  USING (
    branch_id IN (
      SELECT u.branch_id FROM public.users u
      WHERE u.id = auth.uid()
        AND u.branch_id IS NOT NULL
        AND u.branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id())
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = public.current_tenant_id()
      )
    )
  );

-- M1: branch_sales_staff — quitar permisiva USING (true); solo tenant restrict + CRUD acotado
DROP POLICY IF EXISTS branch_sales_staff_select ON public.branch_sales_staff;
CREATE POLICY branch_sales_staff_select ON public.branch_sales_staff
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
