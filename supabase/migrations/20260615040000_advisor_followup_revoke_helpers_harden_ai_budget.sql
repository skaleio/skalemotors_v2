-- ============================================================================
-- Hardening seguridad follow-up (2026-06-15)
-- Revoca EXECUTE de helpers internos (no usados en RLS ni por el frontend) y
-- endurece check_tenant_ai_budget contra sondeo cross-tenant.
-- Aplicado a prod vía MCP el 2026-06-15.
-- ============================================================================

-- 1) resolve_notification_recipients: devolvía usuarios de cualquier tenant → fuga.
REVOKE ALL ON FUNCTION public.resolve_notification_recipients(uuid, uuid, text[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_notification_recipients(uuid, uuid, text[], uuid) TO service_role;

-- 2) Helpers booleanos internos (se llaman dentro de funciones SECURITY DEFINER,
--    no por el cliente; no aparecen en policies RLS).
REVOKE ALL ON FUNCTION public.is_admin_of_branch(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_branch(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.lead_ingest_user_may_manage_branch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_ingest_user_may_manage_branch(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.tenant_is_operational(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_is_operational(uuid) TO service_role;

-- 3) check_tenant_ai_budget: un authenticated solo puede consultar su propio tenant.
--    service_role (edge, sin auth.uid()) sigue pudiendo consultar cualquiera.
CREATE OR REPLACE FUNCTION public.check_tenant_ai_budget(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_budget numeric;
  v_hard_stop boolean;
  v_spent numeric;
  v_month_start date;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_tenant');
  END IF;

  -- Anti cross-tenant: caller autenticado solo su propio tenant.
  IF auth.uid() IS NOT NULL
     AND NOT public.current_is_legacy_protected()
     AND p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'cross_tenant_denied');
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
$function$;
