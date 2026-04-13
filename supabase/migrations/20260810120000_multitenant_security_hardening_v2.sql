-- ============================================================================
-- MIGRACION CORRECTIVA: Hardening completo de multi-tenancy
-- Corrige policies peligrosas, agrega tenant_id a tablas faltantes,
-- agrega RLS restrictivo a TODAS las tablas de datos.
-- Regla ABSOLUTA: no tocar datos de hessen@test.io (legacy_protected)
-- ============================================================================

-- ============================================================================
-- PASO 1: ELIMINAR POLICIES PELIGROSAS QUE DAN ACCESO A ANON/PUBLIC
-- ============================================================================

DROP POLICY IF EXISTS sale_expenses_select ON public.sale_expenses;
DROP POLICY IF EXISTS sale_expenses_delete_anon ON public.sale_expenses;
DROP POLICY IF EXISTS sale_expenses_update_anon ON public.sale_expenses;
DROP POLICY IF EXISTS sale_expenses_delete ON public.sale_expenses;
DROP POLICY IF EXISTS sale_expenses_update ON public.sale_expenses;
DROP POLICY IF EXISTS sale_expenses_insert ON public.sale_expenses;

DROP POLICY IF EXISTS sales_select_all ON public.sales;
DROP POLICY IF EXISTS sales_update_anon ON public.sales;
DROP POLICY IF EXISTS sales_update_all ON public.sales;
DROP POLICY IF EXISTS sales_select ON public.sales;
DROP POLICY IF EXISTS sales_insert ON public.sales;
DROP POLICY IF EXISTS sales_delete ON public.sales;

DROP POLICY IF EXISTS "Allow delete ingresos_empresa" ON public.ingresos_empresa;
DROP POLICY IF EXISTS "Allow read ingresos_empresa" ON public.ingresos_empresa;
DROP POLICY IF EXISTS "Allow update ingresos_empresa" ON public.ingresos_empresa;
DROP POLICY IF EXISTS "Allow insert ingresos_empresa" ON public.ingresos_empresa;

DROP POLICY IF EXISTS branches_select_all ON public.branches;

DROP POLICY IF EXISTS "Consignaciones read" ON public.consignaciones;
DROP POLICY IF EXISTS consignaciones_select_authenticated ON public.consignaciones;

-- ============================================================================
-- PASO 2: CREAR POLICIES PERMISIVAS CORRECTAS (tenant-aware)
-- ============================================================================

CREATE POLICY sales_select_tenant ON public.sales
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

CREATE POLICY sales_insert_tenant ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

CREATE POLICY sales_update_tenant ON public.sales
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

CREATE POLICY sales_delete_tenant ON public.sales
  FOR DELETE TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
  );

CREATE POLICY sale_expenses_select_tenant ON public.sale_expenses
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

CREATE POLICY sale_expenses_insert_tenant ON public.sale_expenses
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

CREATE POLICY sale_expenses_update_tenant ON public.sale_expenses
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

CREATE POLICY sale_expenses_delete_tenant ON public.sale_expenses
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

CREATE POLICY ingresos_select_tenant ON public.ingresos_empresa
  FOR SELECT TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'financiero')
  );

CREATE POLICY ingresos_insert_tenant ON public.ingresos_empresa
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'financiero')
  );

CREATE POLICY ingresos_update_tenant ON public.ingresos_empresa
  FOR UPDATE TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'financiero')
  )
  WITH CHECK (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'financiero')
  );

CREATE POLICY ingresos_delete_tenant ON public.ingresos_empresa
  FOR DELETE TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'financiero')
  );

CREATE POLICY consignaciones_select_tenant ON public.consignaciones
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

-- ============================================================================
-- PASO 3: AGREGAR tenant_id A TABLAS FALTANTES
-- ============================================================================

ALTER TABLE public.tramites ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.marketplace_connections ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.autofact_config ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.meta_ads_connections ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.n8n_workspaces ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.n8n_workflow_executions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.vehicle_listings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.whatsapp_calls ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.whatsapp_inboxes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.studio_prompts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- ============================================================================
-- PASO 4: BACKFILL tenant_id desde branch_id
-- ============================================================================

UPDATE public.tramites t SET tenant_id = b.tenant_id
FROM public.branches b WHERE t.branch_id = b.id AND t.tenant_id IS NULL;

UPDATE public.marketplace_connections mc SET tenant_id = b.tenant_id
FROM public.branches b WHERE mc.branch_id = b.id AND mc.tenant_id IS NULL;

UPDATE public.autofact_config ac SET tenant_id = b.tenant_id
FROM public.branches b WHERE ac.branch_id = b.id AND ac.tenant_id IS NULL;

UPDATE public.meta_ads_connections mac SET tenant_id = b.tenant_id
FROM public.branches b WHERE mac.branch_id = b.id AND mac.tenant_id IS NULL;

UPDATE public.n8n_workspaces nw SET tenant_id = b.tenant_id
FROM public.branches b WHERE nw.branch_id = b.id AND nw.tenant_id IS NULL;

UPDATE public.n8n_workflow_executions nwe SET tenant_id = nw.tenant_id
FROM public.n8n_workspaces nw WHERE nwe.workspace_id = nw.id AND nwe.tenant_id IS NULL;

UPDATE public.vehicle_listings vl SET tenant_id = v.tenant_id
FROM public.vehicles v WHERE vl.vehicle_id = v.id AND vl.tenant_id IS NULL;

UPDATE public.whatsapp_calls wc SET tenant_id = b.tenant_id
FROM public.branches b WHERE wc.branch_id = b.id AND wc.tenant_id IS NULL;

UPDATE public.whatsapp_inboxes wi SET tenant_id = b.tenant_id
FROM public.branches b WHERE wi.branch_id = b.id AND wi.tenant_id IS NULL;

UPDATE public.studio_prompts sp SET tenant_id = b.tenant_id
FROM public.branches b WHERE sp.branch_id = b.id AND sp.tenant_id IS NULL;

-- ============================================================================
-- PASO 5: INDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tramites_tenant_id ON public.tramites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_connections_tenant ON public.marketplace_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_autofact_config_tenant ON public.autofact_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_connections_tenant ON public.meta_ads_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_n8n_workspaces_tenant ON public.n8n_workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_n8n_workflow_executions_tenant ON public.n8n_workflow_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_tenant ON public.vehicle_listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_tenant ON public.whatsapp_calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inboxes_tenant ON public.whatsapp_inboxes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_studio_prompts_tenant ON public.studio_prompts(tenant_id);

-- ============================================================================
-- PASO 6: POLICIES RESTRICTIVAS por tenant en tablas nuevas
-- ============================================================================

DROP POLICY IF EXISTS tenant_restrict_tramites ON public.tramites;
CREATE POLICY tenant_restrict_tramites ON public.tramites
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_marketplace ON public.marketplace_connections;
CREATE POLICY tenant_restrict_marketplace ON public.marketplace_connections
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_autofact ON public.autofact_config;
CREATE POLICY tenant_restrict_autofact ON public.autofact_config
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_meta_ads ON public.meta_ads_connections;
CREATE POLICY tenant_restrict_meta_ads ON public.meta_ads_connections
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_n8n_workspaces ON public.n8n_workspaces;
CREATE POLICY tenant_restrict_n8n_workspaces ON public.n8n_workspaces
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_n8n_executions ON public.n8n_workflow_executions;
CREATE POLICY tenant_restrict_n8n_executions ON public.n8n_workflow_executions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND workspace_id IN (SELECT id FROM public.n8n_workspaces WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_vehicle_listings ON public.vehicle_listings;
CREATE POLICY tenant_restrict_vehicle_listings ON public.vehicle_listings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND vehicle_id IN (SELECT id FROM public.vehicles WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_whatsapp_calls ON public.whatsapp_calls;
CREATE POLICY tenant_restrict_whatsapp_calls ON public.whatsapp_calls
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_whatsapp_inboxes ON public.whatsapp_inboxes;
CREATE POLICY tenant_restrict_whatsapp_inboxes ON public.whatsapp_inboxes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()))
  );

DROP POLICY IF EXISTS tenant_restrict_studio_prompts ON public.studio_prompts;
CREATE POLICY tenant_restrict_studio_prompts ON public.studio_prompts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id IS NULL AND (branch_id IS NULL OR branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id())))
  );

DROP POLICY IF EXISTS "Allow delete expense_types for authenticated" ON public.expense_types;
DROP POLICY IF EXISTS "Allow update expense_types for authenticated" ON public.expense_types;

CREATE POLICY expense_types_update_admin ON public.expense_types
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'jefe_jefe'));

CREATE POLICY expense_types_delete_admin ON public.expense_types
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('admin', 'jefe_jefe'));
