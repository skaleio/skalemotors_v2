-- Seguimiento AM/PM de vendedores con leads (supervisión admin).
CREATE TABLE IF NOT EXISTS public.seller_follow_up_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  follow_up_date date NOT NULL,
  seller_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_follow_up_checks_period_check CHECK (period IN ('am', 'pm')),
  CONSTRAINT seller_follow_up_checks_unique UNIQUE (tenant_id, follow_up_date, seller_user_id, period)
);

COMMENT ON TABLE public.seller_follow_up_checks IS
  'Checklist de seguimiento AM/PM por vendedor y fecha (supervisión gerencial).';

CREATE INDEX IF NOT EXISTS idx_seller_follow_up_checks_tenant_date
  ON public.seller_follow_up_checks (tenant_id, follow_up_date DESC);

CREATE INDEX IF NOT EXISTS idx_seller_follow_up_checks_seller_date
  ON public.seller_follow_up_checks (seller_user_id, follow_up_date DESC);

ALTER TABLE public.seller_follow_up_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_seller_follow_up_checks ON public.seller_follow_up_checks;
CREATE POLICY tenant_restrict_seller_follow_up_checks ON public.seller_follow_up_checks
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );

DROP POLICY IF EXISTS seller_follow_up_checks_select ON public.seller_follow_up_checks;
CREATE POLICY seller_follow_up_checks_select ON public.seller_follow_up_checks
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_role() IN ('admin', 'jefe_jefe', 'gerente', 'jefe_sucursal')
    )
  );

DROP POLICY IF EXISTS seller_follow_up_checks_insert ON public.seller_follow_up_checks;
CREATE POLICY seller_follow_up_checks_insert ON public.seller_follow_up_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_role() IN ('admin', 'jefe_jefe')
    )
  );

DROP POLICY IF EXISTS seller_follow_up_checks_update ON public.seller_follow_up_checks;
CREATE POLICY seller_follow_up_checks_update ON public.seller_follow_up_checks
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_role() IN ('admin', 'jefe_jefe')
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_role() IN ('admin', 'jefe_jefe')
    )
  );

DROP TRIGGER IF EXISTS trg_seller_follow_up_checks_autofill_tenant ON public.seller_follow_up_checks;
CREATE TRIGGER trg_seller_follow_up_checks_autofill_tenant
  BEFORE INSERT ON public.seller_follow_up_checks
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();
