-- ============================================================================
-- CRM por vendedor: created_by + RLS permisiva por rol.
-- - Roles distintos de vendedor: acceso por tenant/sucursal (como antes).
-- - vendedor: solo leads con assigned_to = auth.uid() o created_by = auth.uid(),
--   y branch_id alineado con el perfil.
-- Combina con tenant_restrict_leads (restrictiva) con AND.
-- ============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.created_by IS 'Usuario que creó el lead (default auth.uid()); usado en RLS para vendedores.';

UPDATE public.leads l
SET created_by = l.assigned_to
WHERE l.created_by IS NULL AND l.assigned_to IS NOT NULL;

CREATE OR REPLACE FUNCTION public.leads_set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo sesión de usuario (p. ej. app). Ingestas con service role dejan created_by NULL;
  -- basta assigned_to para que el vendedor vea el lead.
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_set_created_by ON public.leads;
CREATE TRIGGER trg_leads_set_created_by
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.leads_set_created_by();

CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by) WHERE created_by IS NOT NULL;

-- Expresión reutilizable: acceso “equipo” al tenant/sucursal (misma idea que políticas previas).
-- legacy_protected ya tiene bypass aparte.

DROP POLICY IF EXISTS leads_select_auth ON public.leads;
DROP POLICY IF EXISTS leads_insert_auth ON public.leads;
DROP POLICY IF EXISTS leads_update_auth ON public.leads;
DROP POLICY IF EXISTS leads_delete_auth ON public.leads;

CREATE POLICY leads_select_auth ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
    )
  );

CREATE POLICY leads_insert_auth ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
      AND (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );

CREATE POLICY leads_update_auth ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
      AND (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );

CREATE POLICY leads_delete_auth ON public.leads
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (
          tenant_id IS NOT NULL
          AND tenant_id = public.current_tenant_id()
        )
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
    )
    OR (
      public.current_user_role() = 'vendedor'
      AND (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
      )
      AND branch_id IS NOT DISTINCT FROM (
        SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid()
      )
    )
  );
