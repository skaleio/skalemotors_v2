-- ============================================================================
-- Hardening seguridad (2026-06-14) — RLS explícita en tablas con RLS-on/no-policy
-- Cierra advisor: rls_enabled_no_policy (formula_availability_rules,
-- whatsapp_inbox_credentials).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- formula_availability_rules: reglas de disponibilidad del booking.
-- Lectura pública del landing va por formula_get_available_slots (SECURITY
-- DEFINER, no afectada por RLS). El acceso directo a la tabla queda limitado
-- a usuarios del CRM Fórmula.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS formula_availability_rules_crm_all ON public.formula_availability_rules;
CREATE POLICY formula_availability_rules_crm_all ON public.formula_availability_rules
  FOR ALL TO authenticated
  USING (public.user_can_access_formula_crm())
  WITH CHECK (public.user_can_access_formula_crm());

-- ---------------------------------------------------------------------------
-- whatsapp_inbox_credentials: tokens de acceso de inbox (sensible).
-- Solo service_role (Edge Functions) debe leer/escribir. service_role hace
-- bypass de RLS; esta policy explícita documenta que authenticated/anon NO
-- tienen acceso y limpia el lint rls_enabled_no_policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS whatsapp_inbox_credentials_no_client_access ON public.whatsapp_inbox_credentials;
CREATE POLICY whatsapp_inbox_credentials_no_client_access ON public.whatsapp_inbox_credentials
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.whatsapp_inbox_credentials IS
  'Credenciales sensibles de inbox WhatsApp. Acceso exclusivo de service_role (Edge Functions). RLS niega todo a authenticated/anon.';
