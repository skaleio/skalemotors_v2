-- Permitir editar notas de lead (mismo alcance que insert/delete)

ALTER TABLE public.lead_notes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

COMMENT ON COLUMN public.lead_notes.updated_at IS 'Última edición del texto; NULL si nunca se editó.';

DROP POLICY IF EXISTS lead_notes_update ON public.lead_notes;
CREATE POLICY lead_notes_update ON public.lead_notes
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_notes.lead_id
      )
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_notes.lead_id
      )
    )
  );
