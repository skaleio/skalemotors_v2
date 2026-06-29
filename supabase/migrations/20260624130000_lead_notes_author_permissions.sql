-- Endurece UPDATE/DELETE de lead_notes: solo el autor o jefaturas.
--
-- Antes: cualquier usuario del tenant con acceso al lead podía editar o borrar
-- notas ajenas. El control "solo jefaturas borran" vivía únicamente en el
-- frontend, así que por API directa un vendedor podía tocar notas de otro.
--
-- Ahora: jefaturas (admin/gerente/jefe_jefe/jefe_sucursal) gestionan cualquier
-- nota del tenant; el resto de los roles solo las que ellos crearon
-- (created_by = auth.uid()). Las notas legacy migradas (created_by NULL) quedan
-- gestionables solo por jefaturas.

DROP POLICY IF EXISTS lead_notes_update ON public.lead_notes;
CREATE POLICY lead_notes_update ON public.lead_notes
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_can_access_lead(lead_id)
      AND (
        public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal')
        OR created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_can_access_lead(lead_id)
      AND (
        public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal')
        OR created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_notes_delete ON public.lead_notes;
CREATE POLICY lead_notes_delete ON public.lead_notes
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_can_access_lead(lead_id)
      AND (
        public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal')
        OR created_by = auth.uid()
      )
    )
  );
