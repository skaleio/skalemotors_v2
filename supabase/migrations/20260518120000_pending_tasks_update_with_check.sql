-- Asegura que UPDATE en pending_tasks valide la fila resultante (evita updates silenciosos con 0 filas).
DROP POLICY IF EXISTS pending_tasks_update_auth ON public.pending_tasks;

CREATE POLICY pending_tasks_update_auth ON public.pending_tasks
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
