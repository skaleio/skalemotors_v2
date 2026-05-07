-- Defense-in-depth: lead_ingest_keys tiene RLS habilitada sin policies.
-- Las RPC mint/list/revoke usan SECURITY DEFINER y siguen funcionando.
-- Esta migración agrega policies explícitas para SELECT/UPDATE/DELETE
-- desde el cliente para roles admin/jefe_jefe del tenant dueño de la key.

DROP POLICY IF EXISTS lead_ingest_keys_select ON public.lead_ingest_keys;
CREATE POLICY lead_ingest_keys_select ON public.lead_ingest_keys
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe', 'gerente')
  );

DROP POLICY IF EXISTS lead_ingest_keys_update ON public.lead_ingest_keys;
CREATE POLICY lead_ingest_keys_update ON public.lead_ingest_keys
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe')
  );

DROP POLICY IF EXISTS lead_ingest_keys_delete ON public.lead_ingest_keys;
CREATE POLICY lead_ingest_keys_delete ON public.lead_ingest_keys
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe')
  );
