-- Notas individuales por lead (seguimiento con fecha) + cuotas mensuales en CRM

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cuotas_mensuales text;

COMMENT ON COLUMN public.leads.cuotas_mensuales IS 'Cuotas mensuales acordadas o estimadas (texto libre, CRM).';
COMMENT ON COLUMN public.leads.pie_disponible IS 'Pie / enganche (texto libre; CRM y chatbot WhatsApp).';

CREATE TABLE IF NOT EXISTS public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lead_notes IS 'Notas de seguimiento por lead, una fila por nota con fecha de creación.';

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id_created
  ON public.lead_notes (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_notes_tenant_id
  ON public.lead_notes (tenant_id);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_lead_notes ON public.lead_notes;
CREATE POLICY tenant_restrict_lead_notes ON public.lead_notes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
  );

DROP POLICY IF EXISTS lead_notes_select ON public.lead_notes;
CREATE POLICY lead_notes_select ON public.lead_notes
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_notes.lead_id
      )
    )
  );

DROP POLICY IF EXISTS lead_notes_insert ON public.lead_notes;
CREATE POLICY lead_notes_insert ON public.lead_notes
  FOR INSERT TO authenticated
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

DROP POLICY IF EXISTS lead_notes_delete ON public.lead_notes;
CREATE POLICY lead_notes_delete ON public.lead_notes
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_notes.lead_id
      )
    )
  );

DROP TRIGGER IF EXISTS trg_lead_notes_autofill_tenant ON public.lead_notes;
CREATE TRIGGER trg_lead_notes_autofill_tenant
  BEFORE INSERT ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

-- Migrar nota única legacy (leads.notes) a primera entrada en lead_notes
INSERT INTO public.lead_notes (lead_id, tenant_id, branch_id, body, created_at)
SELECT l.id, l.tenant_id, l.branch_id, trim(l.notes), COALESCE(l.updated_at, l.created_at, now())
FROM public.leads l
WHERE l.notes IS NOT NULL
  AND trim(l.notes) <> ''
  AND l.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_notes ln WHERE ln.lead_id = l.id
  );
