-- Permitir que admin del tenant inserte/actualice feature flags (para onboarding)
DROP POLICY IF EXISTS tenant_feature_flags_upsert_admin ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_upsert_admin ON public.tenant_feature_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe')
  );

DROP POLICY IF EXISTS tenant_feature_flags_update_admin ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_update_admin ON public.tenant_feature_flags
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe')
  );
