-- Persistencia de la cascada financiera por venta (CONCESIONARIO).
-- NO toca el schema finance_* (ese es de Fórmula Miami, organization_id).
-- Dos tablas nuevas, modelo tenant_id uuid:
--   sale_cascade_settings : parámetros de la cascada por tenant (montos fijos, % gerencia, socios).
--   sale_breakdown        : snapshot congelado del desglose de cada venta. utilidad_final_miami = margin canónico.
-- Reglas: docs/superpowers/specs/2026-06-14-finanzas-cascada-venta-design.md

-- ============ 1. Config de la cascada por tenant ============
CREATE TABLE IF NOT EXISTS public.sale_cascade_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  comision_venta_default numeric NOT NULL DEFAULT 200000,
  comision_consignador_default numeric NOT NULL DEFAULT 150000,
  pct_gerencia numeric NOT NULL DEFAULT 0.10 CHECK (pct_gerencia >= 0 AND pct_gerencia <= 1),
  socios jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sale_cascade_settings IS
  'Parámetros de la cascada financiera por tenant (montos fijos, % gerencia, socios). socios = [{"nombre":text,"pct":number}]. Nada hardcodeado.';

ALTER TABLE public.sale_cascade_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_sale_cascade_settings ON public.sale_cascade_settings;
CREATE POLICY tenant_restrict_sale_cascade_settings ON public.sale_cascade_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
  );

DROP POLICY IF EXISTS sale_cascade_settings_select ON public.sale_cascade_settings;
CREATE POLICY sale_cascade_settings_select ON public.sale_cascade_settings
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id() AND public.user_may_access_finance_module())
  );

DROP POLICY IF EXISTS sale_cascade_settings_write ON public.sale_cascade_settings;
CREATE POLICY sale_cascade_settings_write ON public.sale_cascade_settings
  FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('admin','gerente','jefe_jefe'))
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('admin','gerente','jefe_jefe'))
  );

-- ============ 2. Snapshot congelado del desglose por venta ============
CREATE TABLE IF NOT EXISTS public.sale_breakdown (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL UNIQUE REFERENCES public.sales(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- insumos congelados
  precio_total numeric NOT NULL,
  pie numeric NOT NULL DEFAULT 0,
  precio_consignacion numeric NOT NULL,
  gasto_general numeric NOT NULL DEFAULT 0,
  comision_venta numeric NOT NULL,
  comision_consignador numeric NOT NULL,
  -- parámetros congelados (los vigentes al cerrar la venta)
  pct_gerencia numeric NOT NULL,
  socios_params jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- resultados congelados de la cascada
  saldo_precio numeric NOT NULL,
  utilidad_bruta numeric NOT NULL,
  gasto_total numeric NOT NULL,
  utilidad_antes_gerencia numeric NOT NULL,
  comision_gerencia numeric NOT NULL,
  utilidad_post_gerencia numeric NOT NULL,
  socios_montos jsonb NOT NULL DEFAULT '[]'::jsonb,
  utilidad_final_miami numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sale_breakdown IS
  'Snapshot congelado de la cascada financiera de una venta. utilidad_final_miami = margin canónico que alimenta el balance. Recalcular es explícito; cambiar settings no reescribe filas pasadas.';

CREATE INDEX IF NOT EXISTS idx_sale_breakdown_tenant ON public.sale_breakdown(tenant_id);

ALTER TABLE public.sale_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_sale_breakdown ON public.sale_breakdown;
CREATE POLICY tenant_restrict_sale_breakdown ON public.sale_breakdown
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
  );

DROP POLICY IF EXISTS sale_breakdown_select ON public.sale_breakdown;
CREATE POLICY sale_breakdown_select ON public.sale_breakdown
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id() AND public.user_may_access_finance_module())
  );

DROP POLICY IF EXISTS sale_breakdown_write ON public.sale_breakdown;
CREATE POLICY sale_breakdown_write ON public.sale_breakdown
  FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('admin','gerente','jefe_jefe','jefe_sucursal'))
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id()
        AND public.current_user_role() IN ('admin','gerente','jefe_jefe','jefe_sucursal'))
  );

-- ============ 3. Seed de settings por tenant ============
-- Miami Motors: socios Antonio/Juampi/Leonardo (3/3/4) y montos fijos del libro.
INSERT INTO public.sale_cascade_settings
  (tenant_id, comision_venta_default, comision_consignador_default, pct_gerencia, socios)
VALUES (
  'dc7b8be8-d4e6-4875-b2a0-6558ba6a6c97',
  200000, 150000, 0.10,
  '[{"nombre":"Antonio","pct":0.03},{"nombre":"Juampi","pct":0.03},{"nombre":"Leonardo","pct":0.04}]'::jsonb
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Resto de tenants: defaults sin socios (cada uno configura los suyos).
INSERT INTO public.sale_cascade_settings (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;
