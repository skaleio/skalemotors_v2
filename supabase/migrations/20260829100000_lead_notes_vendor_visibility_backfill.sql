-- Recuperación + prevención: notas de vendedor no deben depender solo de leads.notes
-- (la ingesta WhatsApp/n8n puede pisar esa columna en updates).

-- 1) Backfill idempotente: copiar leads.notes → lead_notes si aún no existe esa nota.
INSERT INTO public.lead_notes (lead_id, tenant_id, branch_id, body, created_at)
SELECT l.id, l.tenant_id, l.branch_id, trim(l.notes), COALESCE(l.updated_at, l.created_at, now())
FROM public.leads l
WHERE l.notes IS NOT NULL
  AND trim(l.notes) <> ''
  AND l.tenant_id IS NOT NULL
  AND l.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_notes ln
    WHERE ln.lead_id = l.id
      AND trim(ln.body) = trim(l.notes)
  );

-- 2) Helper: el usuario actual puede ver el lead dueño de la nota (incluye vendedor asignado).
CREATE OR REPLACE FUNCTION public.current_user_can_access_lead(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = p_lead_id
      AND l.deleted_at IS NULL
      AND (
        public.current_is_legacy_protected()
        OR (
          public.current_user_role() IS DISTINCT FROM 'vendedor'
          AND l.tenant_id = public.current_tenant_id()
        )
        OR (
          public.current_user_role() = 'vendedor'
          AND l.tenant_id = public.current_tenant_id()
          AND l.branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
          AND (
            l.assigned_to = auth.uid()
            OR (l.created_by = auth.uid() AND l.assigned_to IS NULL)
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_access_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_lead(uuid) TO authenticated, service_role;

-- 3) RLS lead_notes alineada con visibilidad real del lead (vendedor asignado incluido).
DROP POLICY IF EXISTS lead_notes_select ON public.lead_notes;
CREATE POLICY lead_notes_select ON public.lead_notes
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
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
      AND public.current_user_can_access_lead(lead_id)
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_can_access_lead(lead_id)
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
    )
  );

-- 4) Trigger: bloquear que un UPDATE de ingesta pise leads.notes si ya hay notas de seguimiento.
CREATE OR REPLACE FUNCTION public.protect_lead_notes_on_leads_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.notes IS DISTINCT FROM OLD.notes
     AND EXISTS (SELECT 1 FROM public.lead_notes ln WHERE ln.lead_id = NEW.id)
  THEN
    NEW.notes := OLD.notes;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_lead_notes_on_leads_update ON public.leads;
CREATE TRIGGER trg_protect_lead_notes_on_leads_update
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_lead_notes_on_leads_update();

COMMENT ON FUNCTION public.current_user_can_access_lead(uuid) IS
  'RLS helper: true si el usuario autenticado puede ver el lead (misma regla que leads_select_auth para vendedor).';
