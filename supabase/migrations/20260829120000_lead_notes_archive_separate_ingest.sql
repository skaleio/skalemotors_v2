-- Separación definitiva:
--   leads.notes     → resumen WhatsApp/n8n (actualizable por ingesta)
--   lead_notes      → seguimiento humano de vendedores (nunca tocado por n8n)
--   lead_notes_archive → respaldo append-only de cada cambio en lead_notes

-- Quitar trigger que bloqueaba updates de leads.notes (n8n debe poder actualizar su resumen).
DROP TRIGGER IF EXISTS trg_protect_lead_notes_on_leads_update ON public.leads;
DROP FUNCTION IF EXISTS public.protect_lead_notes_on_leads_update();

ALTER TABLE public.lead_notes
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'vendor';

ALTER TABLE public.lead_notes
  DROP CONSTRAINT IF EXISTS lead_notes_source_check;

ALTER TABLE public.lead_notes
  ADD CONSTRAINT lead_notes_source_check
  CHECK (source IN ('vendor', 'system'));

COMMENT ON COLUMN public.lead_notes.source IS
  'vendor = nota de seguimiento humana; system = uso interno (no mostrar en CRM).';

UPDATE public.lead_notes
SET source = 'vendor'
WHERE created_by IS NOT NULL;

UPDATE public.lead_notes
SET source = 'system'
WHERE created_by IS NULL;

-- Tabla de respaldo (historial completo, nunca se borra desde la app).
CREATE TABLE IF NOT EXISTS public.lead_notes_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  note_created_at timestamptz NOT NULL,
  note_updated_at timestamptz,
  source text NOT NULL DEFAULT 'vendor',
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_action text NOT NULL CHECK (
    archive_action IN ('insert', 'update', 'delete', 'seed', 'separate_ingest')
  ),
  archived_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.lead_notes_archive IS
  'Respaldo append-only de lead_notes. Permite recuperar seguimiento si una nota se edita o elimina.';

CREATE INDEX IF NOT EXISTS idx_lead_notes_archive_lead_id_archived
  ON public.lead_notes_archive (lead_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_notes_archive_note_id
  ON public.lead_notes_archive (note_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_notes_archive_tenant_id
  ON public.lead_notes_archive (tenant_id);

ALTER TABLE public.lead_notes_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_lead_notes_archive ON public.lead_notes_archive;
CREATE POLICY tenant_restrict_lead_notes_archive ON public.lead_notes_archive
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
  );

DROP POLICY IF EXISTS lead_notes_archive_select ON public.lead_notes_archive;
CREATE POLICY lead_notes_archive_select ON public.lead_notes_archive
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_can_access_lead(lead_id)
    )
  );

-- Snapshot inicial del estado actual (antes de limpiar duplicados de ingesta).
INSERT INTO public.lead_notes_archive (
  note_id, lead_id, tenant_id, branch_id, body, created_by,
  note_created_at, note_updated_at, source, archive_action
)
SELECT
  ln.id, ln.lead_id, ln.tenant_id, ln.branch_id, ln.body, ln.created_by,
  ln.created_at, ln.updated_at, ln.source, 'seed'
FROM public.lead_notes ln
WHERE NOT EXISTS (
  SELECT 1 FROM public.lead_notes_archive a WHERE a.note_id = ln.id AND a.archive_action = 'seed'
);

-- Sacar de lead_notes el resumen n8n que se había copiado por error (queda solo en leads.notes).
INSERT INTO public.lead_notes_archive (
  note_id, lead_id, tenant_id, branch_id, body, created_by,
  note_created_at, note_updated_at, source, archive_action
)
SELECT
  ln.id, ln.lead_id, ln.tenant_id, ln.branch_id, ln.body, ln.created_by,
  ln.created_at, ln.updated_at, ln.source, 'separate_ingest'
FROM public.lead_notes ln
INNER JOIN public.leads l ON l.id = ln.lead_id
WHERE ln.created_by IS NULL
  AND l.notes IS NOT NULL
  AND trim(l.notes) <> ''
  AND trim(ln.body) = trim(l.notes)
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_notes_archive a
    WHERE a.note_id = ln.id AND a.archive_action = 'separate_ingest'
  );

DELETE FROM public.lead_notes ln
USING public.leads l
WHERE ln.lead_id = l.id
  AND ln.created_by IS NULL
  AND l.notes IS NOT NULL
  AND trim(l.notes) <> ''
  AND trim(ln.body) = trim(l.notes);

-- Archivar automáticamente cada cambio en lead_notes.
CREATE OR REPLACE FUNCTION public.archive_lead_note_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_notes_archive (
      note_id, lead_id, tenant_id, branch_id, body, created_by,
      note_created_at, note_updated_at, source, archive_action, archived_by
    ) VALUES (
      NEW.id, NEW.lead_id, NEW.tenant_id, NEW.branch_id, NEW.body, NEW.created_by,
      NEW.created_at, NEW.updated_at, NEW.source, 'insert', auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.lead_notes_archive (
      note_id, lead_id, tenant_id, branch_id, body, created_by,
      note_created_at, note_updated_at, source, archive_action, archived_by
    ) VALUES (
      OLD.id, OLD.lead_id, OLD.tenant_id, OLD.branch_id, OLD.body, OLD.created_by,
      OLD.created_at, OLD.updated_at, OLD.source, 'update', auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.lead_notes_archive (
      note_id, lead_id, tenant_id, branch_id, body, created_by,
      note_created_at, note_updated_at, source, archive_action, archived_by
    ) VALUES (
      OLD.id, OLD.lead_id, OLD.tenant_id, OLD.branch_id, OLD.body, OLD.created_by,
      OLD.created_at, OLD.updated_at, OLD.source, 'delete', auth.uid()
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_lead_note_change ON public.lead_notes;
CREATE TRIGGER trg_archive_lead_note_change
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.archive_lead_note_change();

-- Forzar source vendor en notas creadas por humanos.
CREATE OR REPLACE FUNCTION public.enforce_lead_note_vendor_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    NEW.source := 'vendor';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lead_note_vendor_source ON public.lead_notes;
CREATE TRIGGER trg_enforce_lead_note_vendor_source
  BEFORE INSERT OR UPDATE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lead_note_vendor_source();

-- Solo supervisión puede eliminar notas vivas; vendedor conserva historial en archive.
DROP POLICY IF EXISTS lead_notes_delete ON public.lead_notes;
CREATE POLICY lead_notes_delete ON public.lead_notes
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal')
      AND public.current_user_can_access_lead(lead_id)
      AND source = 'vendor'
    )
  );

-- Listados CRM: solo notas de vendedor (no system).
DROP POLICY IF EXISTS lead_notes_select ON public.lead_notes;
CREATE POLICY lead_notes_select ON public.lead_notes
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND source = 'vendor'
      AND public.current_user_can_access_lead(lead_id)
    )
  );

DROP POLICY IF EXISTS lead_notes_insert ON public.lead_notes;
CREATE POLICY lead_notes_insert ON public.lead_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND source = 'vendor'
      AND public.current_user_can_access_lead(lead_id)
    )
  );

DROP POLICY IF EXISTS lead_notes_update ON public.lead_notes;
CREATE POLICY lead_notes_update ON public.lead_notes
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND source = 'vendor'
      AND public.current_user_can_access_lead(lead_id)
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND source = 'vendor'
      AND public.current_user_can_access_lead(lead_id)
    )
  );
