-- ============================================================================
-- Risk mitigation pack (MFA policy support, AI quotas, RLS IA fix, Ley 19.628,
-- tenant lifecycle / portability). Regla: no tocar datos legacy hessen@test.io.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Fix C1: policies IA — admin solo dentro de su tenant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ai_conversations_select ON public.ai_conversations;
CREATE POLICY ai_conversations_select ON public.ai_conversations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = public.current_tenant_id())
    )
  );

DROP POLICY IF EXISTS ai_messages_select ON public.ai_messages;
CREATE POLICY ai_messages_select ON public.ai_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
    OR (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = public.current_tenant_id())
      AND EXISTS (
        SELECT 1 FROM public.ai_conversations c
        WHERE c.id = conversation_id AND c.tenant_id = public.current_tenant_id()
      )
    )
  );

DROP POLICY IF EXISTS ai_usage_logs_select ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_select ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR branch_id IN (SELECT branch_id FROM public.users WHERE id = auth.uid())
    OR (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = public.current_tenant_id())
    )
  );

DROP POLICY IF EXISTS ai_branch_brain_select ON public.ai_branch_brain;
CREATE POLICY ai_branch_brain_select ON public.ai_branch_brain FOR SELECT TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM public.users WHERE id = auth.uid())
    OR (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = public.current_tenant_id())
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Cuotas de costo IA por tenant (unit economics)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_ai_quotas (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  monthly_budget_usd numeric(10, 2) NOT NULL DEFAULT 25.00,
  hard_stop boolean NOT NULL DEFAULT true,
  alert_threshold_pct numeric(5, 2) NOT NULL DEFAULT 80.00,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_ai_quotas IS
  'Presupuesto mensual USD de IA por tenant. hard_stop=true bloquea llamadas al superar el tope.';

ALTER TABLE public.tenant_ai_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_ai_quotas_select ON public.tenant_ai_quotas;
CREATE POLICY tenant_ai_quotas_select ON public.tenant_ai_quotas
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('admin', 'gerente', 'financiero', 'jefe_jefe'));

DROP POLICY IF EXISTS tenant_restrict_tenant_ai_quotas ON public.tenant_ai_quotas;
CREATE POLICY tenant_restrict_tenant_ai_quotas ON public.tenant_ai_quotas
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE OR REPLACE FUNCTION public.check_tenant_ai_budget(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_budget numeric;
  v_hard_stop boolean;
  v_spent numeric;
  v_month_start date;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_tenant');
  END IF;

  v_month_start := date_trunc('month', current_date)::date;

  SELECT monthly_budget_usd, hard_stop
  INTO v_budget, v_hard_stop
  FROM public.tenant_ai_quotas
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    v_budget := 25.00;
    v_hard_stop := true;
  END IF;

  SELECT coalesce(sum(
    (coalesce(l.tokens_input, 0) * coalesce(p.input_per_1k_usd, 0) / 1000.0)
    + (coalesce(l.tokens_output, 0) * coalesce(p.output_per_1k_usd, 0) / 1000.0)
  ), 0)
  INTO v_spent
  FROM public.ai_usage_logs l
  LEFT JOIN public.ai_model_pricing p ON p.model = l.model
  WHERE l.tenant_id = p_tenant_id
    AND l.created_at >= v_month_start;

  RETURN jsonb_build_object(
    'allowed', NOT (v_hard_stop AND v_spent >= v_budget),
    'spent_usd', round(v_spent::numeric, 4),
    'budget_usd', v_budget,
    'hard_stop', v_hard_stop,
    'month_start', v_month_start
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_tenant_ai_budget(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_tenant_ai_budget(uuid) TO authenticated, service_role;

-- Seed cuota default para tenants existentes sin fila
INSERT INTO public.tenant_ai_quotas (tenant_id, monthly_budget_usd, hard_stop)
SELECT t.id, 25.00, true
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_ai_quotas q WHERE q.tenant_id = t.id)
ON CONFLICT (tenant_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Tenant lifecycle (churn / MRR tracking — reduce impacto operativo)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'suspended', 'churned')),
  ADD COLUMN IF NOT EXISTS mrr_clp bigint,
  ADD COLUMN IF NOT EXISTS churned_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_export_requested_at timestamptz;

COMMENT ON COLUMN public.tenants.lifecycle_status IS 'active=normal; suspended=bloqueo login; churned=offboarding';
COMMENT ON COLUMN public.tenants.mrr_clp IS 'MRR estimado en CLP para reporting interno (no facturación automática)';

CREATE OR REPLACE FUNCTION public.tenant_is_operational(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT coalesce(
    (SELECT lifecycle_status = 'active' FROM public.tenants WHERE id = p_tenant_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.tenant_is_operational(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_is_operational(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Ley 19.628 — registro de consentimientos y derechos ARCO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.privacy_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  body_url text,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_privacy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_version_id uuid NOT NULL REFERENCES public.privacy_policy_versions(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, policy_version_id)
);

CREATE TABLE IF NOT EXISTS public.lead_data_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('contact_whatsapp', 'contact_phone', 'contact_email', 'marketing', 'data_processing')),
  granted boolean NOT NULL DEFAULT true,
  source text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_data_consents_lead ON public.lead_data_consents(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_data_consents_tenant ON public.lead_data_consents(tenant_id);

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('lead', 'user')),
  subject_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'rectification', 'deletion', 'portability')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  notes text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.privacy_policy_versions (version, title, body_url, effective_at)
VALUES (
  '2026-05-17',
  'Política de tratamiento de datos personales — Skale Motors',
  'https://skalemotors.cl/privacidad',
  now()
)
ON CONFLICT (version) DO NOTHING;

ALTER TABLE public.privacy_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_privacy_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_data_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY privacy_policy_versions_read ON public.privacy_policy_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY user_privacy_acceptances_own ON public.user_privacy_acceptances
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tenant_restrict_user_privacy_acceptances ON public.user_privacy_acceptances;
CREATE POLICY tenant_restrict_user_privacy_acceptances ON public.user_privacy_acceptances
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id() OR tenant_id IS NULL);

CREATE POLICY lead_data_consents_tenant ON public.lead_data_consents
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

CREATE POLICY data_subject_requests_tenant ON public.data_subject_requests
  FOR ALL TO authenticated
  USING (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
  )
  WITH CHECK (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
  );

CREATE TRIGGER trg_lead_data_consents_autofill_tenant
  BEFORE INSERT ON public.lead_data_consents
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE TRIGGER trg_data_subject_requests_autofill_tenant
  BEFORE INSERT ON public.data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

-- RPC: export portable JSON del tenant (reduce lock-in Supabase)
CREATE OR REPLACE FUNCTION public.export_tenant_data_bundle(p_tenant_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_tid uuid;
  v_role text;
BEGIN
  v_tid := coalesce(p_tenant_id, public.current_tenant_id());
  v_role := public.current_user_role();

  IF v_tid IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;

  IF NOT public.current_is_legacy_protected() AND v_tid <> public.current_tenant_id() THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  IF v_role NOT IN ('admin', 'gerente', 'jefe_jefe') AND NOT public.current_is_legacy_protected() THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  UPDATE public.tenants SET data_export_requested_at = now() WHERE id = v_tid;

  RETURN jsonb_build_object(
    'exported_at', now(),
    'tenant_id', v_tid,
    'tenant', (SELECT to_jsonb(t) FROM public.tenants t WHERE t.id = v_tid),
    'branches', coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM public.branches b WHERE b.tenant_id = v_tid), '[]'::jsonb),
    'users', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', u.id, 'email', u.email, 'full_name', u.full_name, 'role', u.role, 'branch_id', u.branch_id, 'is_active', u.is_active
    )) FROM public.users u WHERE u.tenant_id = v_tid), '[]'::jsonb),
    'leads_count', (SELECT count(*) FROM public.leads l WHERE l.tenant_id = v_tid),
    'vehicles_count', (SELECT count(*) FROM public.vehicles v WHERE v.tenant_id = v_tid),
    'sales_count', (SELECT count(*) FROM public.sales s WHERE s.tenant_id = v_tid),
    'ai_usage_month_usd', public.check_tenant_ai_budget(v_tid)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.export_tenant_data_bundle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_tenant_data_bundle(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.export_tenant_data_bundle(uuid) IS
  'Bundle JSON portable del tenant para portabilidad (Ley 19.628) y reducir lock-in. Solo admin/gerente/jefe_jefe del tenant.';

CREATE OR REPLACE FUNCTION public.trg_tenants_seed_ai_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.tenant_ai_quotas (tenant_id, monthly_budget_usd, hard_stop)
  VALUES (NEW.id, 25.00, true)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_seed_ai_quota ON public.tenants;
CREATE TRIGGER trg_tenants_seed_ai_quota
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.trg_tenants_seed_ai_quota();
