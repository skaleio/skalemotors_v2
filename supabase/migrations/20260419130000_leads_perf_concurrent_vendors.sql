-- ============================================================================
-- PERFORMANCE: acelerar CRM de vendedores concurrentes.
-- Problema: RLS de vendedores filtra por (assigned_to = auth.uid())
--          y branch_id = (SELECT branch_id FROM users WHERE id = auth.uid()).
-- Con 9 vendedores cargando su CRM en paralelo, cada SELECT hace:
--   1) current_user_role() -> users
--   2) current_tenant_id() -> users
--   3) current_is_legacy_protected() -> users
--   4) subquery inline branch_id -> users
-- Además faltan índices para el filtro assigned_to + deleted_at + created_at.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper estable para branch_id del caller (reduce subqueries en RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.users WHERE id = auth.uid() LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_user_branch_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_branch_id() TO authenticated;

COMMENT ON FUNCTION public.current_user_branch_id() IS
  'Helper estable para RLS: devuelve users.branch_id del caller (auth.uid()).';

-- ----------------------------------------------------------------------------
-- 2. Índices faltantes para el hot-path del vendedor
-- ----------------------------------------------------------------------------

-- CRM del vendedor: listar "mis leads activos" ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_leads_vendor_crm
  ON public.leads (assigned_to, deleted_at, created_at DESC)
  WHERE assigned_to IS NOT NULL;

-- Ruta alternativa: "leads que creé" (vendedor que registra walk-in)
CREATE INDEX IF NOT EXISTS idx_leads_created_by_active
  ON public.leads (created_by, deleted_at, created_at DESC)
  WHERE created_by IS NOT NULL;

-- Admin / gerente: dashboard listando todo del tenant
CREATE INDEX IF NOT EXISTS idx_leads_tenant_active
  ON public.leads (tenant_id, deleted_at, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Filtros por estado (pipeline kanban)
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status
  ON public.leads (tenant_id, status, deleted_at)
  WHERE tenant_id IS NOT NULL AND deleted_at IS NULL;

-- Branch scoping cuando tenant_id viene NULL en ingestas legacy
CREATE INDEX IF NOT EXISTS idx_leads_branch_active
  ON public.leads (branch_id, deleted_at, created_at DESC)
  WHERE branch_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Índices adicionales para foreign keys que aparecen en joins del CRM
-- ----------------------------------------------------------------------------

-- assigned_user:users!leads_assigned_to_fkey -- join frecuente en getAll()
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to
  ON public.leads (assigned_to)
  WHERE assigned_to IS NOT NULL;

-- lead_activities busca por lead_id (detalle del lead trae todas las actividades)
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id
  ON public.lead_activities (lead_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Reescribir la política de SELECT del vendedor para usar el helper
-- (misma semántica, menos subqueries inline)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS leads_select_auth ON public.leads;
CREATE POLICY leads_select_auth ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
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
      AND (assigned_to = auth.uid() OR created_by = auth.uid())
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
    )
  );

DROP POLICY IF EXISTS leads_insert_auth ON public.leads;
CREATE POLICY leads_insert_auth ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
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
        (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
      AND (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );

DROP POLICY IF EXISTS leads_update_auth ON public.leads;
CREATE POLICY leads_update_auth ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
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
      AND (assigned_to = auth.uid() OR created_by = auth.uid())
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
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
        (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
        OR (
          tenant_id IS NULL
          AND branch_id IS NOT NULL
          AND branch_id IN (
            SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
          )
        )
      )
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
      AND (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );

DROP POLICY IF EXISTS leads_delete_auth ON public.leads;
CREATE POLICY leads_delete_auth ON public.leads
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      public.current_user_role() IS DISTINCT FROM 'vendedor'
      AND (
        (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
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
      AND (assigned_to = auth.uid() OR created_by = auth.uid())
      AND branch_id IS NOT DISTINCT FROM public.current_user_branch_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 5. ANALYZE para que el planner tenga estadísticas frescas
-- ----------------------------------------------------------------------------
ANALYZE public.leads;
ANALYZE public.users;
