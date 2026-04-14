-- Vendedores de sucursal sin cuenta de auth: visibles en CRM (cerrar negocio) y en métricas futuras.
CREATE TABLE IF NOT EXISTS public.branch_sales_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  role_label TEXT NOT NULL DEFAULT 'Vendedor',
  base_salary_clp NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT branch_sales_staff_salary_non_negative CHECK (base_salary_clp >= 0)
);

CREATE INDEX IF NOT EXISTS idx_branch_sales_staff_tenant ON public.branch_sales_staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_sales_staff_branch ON public.branch_sales_staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_sales_staff_active ON public.branch_sales_staff(tenant_id, branch_id) WHERE is_active = true;

COMMENT ON TABLE public.branch_sales_staff IS 'Vendedores registrados en la app (sin usuario auth). Se usan al cerrar negocio en CRM.';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS closed_by_staff_id UUID REFERENCES public.branch_sales_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_closed_by_staff ON public.leads(closed_by_staff_id) WHERE closed_by_staff_id IS NOT NULL;

ALTER TABLE public.branch_sales_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_branch_sales_staff ON public.branch_sales_staff;
CREATE POLICY tenant_restrict_branch_sales_staff ON public.branch_sales_staff
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS branch_sales_staff_select ON public.branch_sales_staff;
CREATE POLICY branch_sales_staff_select ON public.branch_sales_staff
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS branch_sales_staff_insert ON public.branch_sales_staff;
CREATE POLICY branch_sales_staff_insert ON public.branch_sales_staff
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe', 'gerente', 'jefe_sucursal')
  );

DROP POLICY IF EXISTS branch_sales_staff_update ON public.branch_sales_staff;
CREATE POLICY branch_sales_staff_update ON public.branch_sales_staff
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe', 'gerente', 'jefe_sucursal')
  )
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS branch_sales_staff_delete ON public.branch_sales_staff;
CREATE POLICY branch_sales_staff_delete ON public.branch_sales_staff
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'jefe_jefe', 'gerente', 'jefe_sucursal')
  );
