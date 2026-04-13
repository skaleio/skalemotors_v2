-- ============================================================================
-- FIX: Restaurar policies permisivas para tabla users
-- Sin estas, la policy restrictiva sola bloquea todo el acceso
-- ============================================================================

-- SELECT: usuarios autenticados ven usuarios de su mismo tenant
DROP POLICY IF EXISTS users_select_same_tenant ON public.users;
CREATE POLICY users_select_same_tenant ON public.users
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR public.current_is_legacy_protected()
  );

-- UPDATE: solo el propio usuario puede actualizar campos seguros
DROP POLICY IF EXISTS users_update_self_safe ON public.users;
CREATE POLICY users_update_self_safe ON public.users
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    AND (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  )
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND tenant_id IS NOT DISTINCT FROM (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND branch_id IS NOT DISTINCT FROM (SELECT branch_id FROM public.users WHERE id = auth.uid())
    AND legacy_protected = (SELECT legacy_protected FROM public.users WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
  );
