-- ============================================================================
-- Supabase Database Linter — correcciones de seguridad (2026-08-28)
-- search_path, RLS permisivas, EXECUTE en triggers, storage listing, extensión
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) search_path inmutable en funciones señaladas
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.formula_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.formula_students_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.chile_today_date() SET search_path = public, pg_temp;
ALTER FUNCTION public.vehicles_sync_status_changed_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.finance_formula_miami_payments_set_updated_at() SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2) Extensión btree_gist fuera de public (advisor extension_in_public)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    ALTER EXTENSION btree_gist SET SCHEMA extensions;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Helpers para RLS finance_* (organization_id = slug del tenant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_finance_organization_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT t.slug
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_finance_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_finance_organization_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.user_may_access_finance_module()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    public.current_is_legacy_protected()
    OR (
      public.current_finance_organization_id() IS NOT NULL
      AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe', 'financiero')
    );
$$;

REVOKE ALL ON FUNCTION public.user_may_access_finance_module() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_may_access_finance_module() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Helper Formula CRM (tablas sin tenant_id — flag por tenant)
-- ---------------------------------------------------------------------------
INSERT INTO public.tenant_feature_flags (tenant_id, flag_key, enabled)
SELECT t.id, 'formula_crm', true
FROM public.tenants t
WHERE t.slug = 'miami-530459'
ON CONFLICT (tenant_id, flag_key) DO UPDATE SET enabled = EXCLUDED.enabled;

CREATE OR REPLACE FUNCTION public.user_can_access_formula_crm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    public.current_is_legacy_protected()
    OR EXISTS (
      SELECT 1
      FROM public.tenant_feature_flags f
      JOIN public.users u ON u.tenant_id = f.tenant_id
      WHERE u.id = auth.uid()
        AND u.is_active = true
        AND f.flag_key = 'formula_crm'
        AND f.enabled = true
        AND public.current_user_role() IN (
          'admin', 'gerente', 'jefe_jefe', 'financiero', 'jefe_sucursal', 'vendedor'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_formula_crm() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_formula_crm() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) RLS finance_* — reemplazar policies USING(true)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_commissions',
    'finance_expense_categories',
    'finance_expenses',
    'finance_formula_miami_payments',
    'finance_income',
    'finance_monthly_close',
    'finance_profit_distribution',
    'finance_settings'
  ]
  LOOP
    pol := CASE t
      WHEN 'finance_commissions' THEN 'finance_commissions_all'
      WHEN 'finance_expense_categories' THEN 'finance_categories_all'
      WHEN 'finance_expenses' THEN 'finance_expenses_all'
      WHEN 'finance_formula_miami_payments' THEN 'finance_formula_miami_payments_all'
      WHEN 'finance_income' THEN 'finance_income_all'
      WHEN 'finance_monthly_close' THEN 'finance_close_all'
      WHEN 'finance_profit_distribution' THEN 'finance_distribution_all'
      WHEN 'finance_settings' THEN 'finance_settings_all'
    END;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (
         public.user_may_access_finance_module()
         AND (public.current_is_legacy_protected() OR organization_id = public.current_finance_organization_id())
       )
       WITH CHECK (
         public.user_may_access_finance_module()
         AND (public.current_is_legacy_protected() OR organization_id = public.current_finance_organization_id())
       )',
      pol || '_tenant',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6) RLS formula_* — reemplazar INSERT/UPDATE/DELETE con true
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS formula_appointments_crm_delete ON public.formula_appointments;
DROP POLICY IF EXISTS formula_appointments_crm_update ON public.formula_appointments;

CREATE POLICY formula_appointments_crm_update ON public.formula_appointments
  FOR UPDATE TO authenticated
  USING (public.user_can_access_formula_crm())
  WITH CHECK (public.user_can_access_formula_crm());

CREATE POLICY formula_appointments_crm_delete ON public.formula_appointments
  FOR DELETE TO authenticated
  USING (public.user_can_access_formula_crm());

DROP POLICY IF EXISTS formula_leads_crm_delete ON public.formula_leads;
DROP POLICY IF EXISTS formula_leads_crm_update_stage ON public.formula_leads;

CREATE POLICY formula_leads_crm_update_stage ON public.formula_leads
  FOR UPDATE TO authenticated
  USING (public.user_can_access_formula_crm())
  WITH CHECK (public.user_can_access_formula_crm());

CREATE POLICY formula_leads_crm_delete ON public.formula_leads
  FOR DELETE TO authenticated
  USING (public.user_can_access_formula_crm());

DROP POLICY IF EXISTS formula_student_payments_crm_all ON public.formula_student_payments;
CREATE POLICY formula_student_payments_crm_rw ON public.formula_student_payments
  FOR ALL TO authenticated
  USING (public.user_can_access_formula_crm())
  WITH CHECK (public.user_can_access_formula_crm());

DROP POLICY IF EXISTS formula_students_crm_all ON public.formula_students;
CREATE POLICY formula_students_crm_rw ON public.formula_students
  FOR ALL TO authenticated
  USING (public.user_can_access_formula_crm())
  WITH CHECK (public.user_can_access_formula_crm());

-- ---------------------------------------------------------------------------
-- 7) Storage site-assets: quitar listado público (bucket sigue public para URLs)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS site_assets_public_read ON storage.objects;

-- ---------------------------------------------------------------------------
-- 8) REVOKE EXECUTE: triggers y RPCs que no deben ser anon
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_tenant_ai_budget(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_tenant_ai_budget(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tenant_is_operational(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_is_operational(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_daily_sales_report_pending_task() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_daily_sales_report_pending_task() TO service_role;

REVOKE ALL ON FUNCTION public.sync_daily_sales_report_tasks(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_daily_sales_report_tasks(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.trg_tenants_seed_ai_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_tenants_seed_ai_quota() TO service_role;

REVOKE ALL ON FUNCTION public.validate_consignacion_tenant_branch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_consignacion_tenant_branch() TO service_role;

REVOKE ALL ON FUNCTION public.validate_lead_assigned_to() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_lead_assigned_to() TO service_role;

REVOKE ALL ON FUNCTION public.formula_set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.formula_set_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.formula_students_set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.formula_students_set_updated_at() TO service_role;

REVOKE ALL ON FUNCTION public.finance_formula_miami_payments_set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_formula_miami_payments_set_updated_at() TO service_role;

-- Formula booking público: anon explícito (landing sin login)
REVOKE ALL ON FUNCTION public.formula_book_appointment(
  text, timestamptz, text, text, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formula_book_appointment(
  text, timestamptz, text, text, text, text, text, text, text
) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.formula_get_available_slots(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formula_get_available_slots(text, date) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.formula_cancel_appointment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formula_cancel_appointment(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.formula_reschedule_appointment(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formula_reschedule_appointment(uuid, timestamptz) TO authenticated, service_role;

-- Explícito: helpers RLS y RPCs sensibles no expuestos a anon (lint 0028)
REVOKE ALL ON FUNCTION public.check_tenant_ai_budget(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.tenant_is_operational(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.current_finance_organization_id() FROM anon;
REVOKE ALL ON FUNCTION public.user_may_access_finance_module() FROM anon;
REVOKE ALL ON FUNCTION public.user_can_access_formula_crm() FROM anon;
REVOKE ALL ON FUNCTION public.sync_daily_sales_report_tasks(date) FROM anon;
REVOKE ALL ON FUNCTION public.formula_reschedule_appointment(uuid, timestamptz) FROM anon;
