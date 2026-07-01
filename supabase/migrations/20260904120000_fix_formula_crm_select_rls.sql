-- Cierra el SELECT abierto (USING true) del CRM Fórmula Miami.
-- 20260828120000 protegió UPDATE/DELETE con user_can_access_formula_crm(),
-- pero el SELECT quedó legible para cualquier usuario autenticado de cualquier tenant
-- (leads con nombre, email, teléfono e ingresos_mensuales incluidos).

DROP POLICY IF EXISTS formula_leads_crm_select ON public.formula_leads;
CREATE POLICY formula_leads_crm_select ON public.formula_leads
  FOR SELECT TO authenticated
  USING (public.user_can_access_formula_crm());

DROP POLICY IF EXISTS formula_appointments_crm_select ON public.formula_appointments;
CREATE POLICY formula_appointments_crm_select ON public.formula_appointments
  FOR SELECT TO authenticated
  USING (public.user_can_access_formula_crm());

DROP POLICY IF EXISTS formula_calendar_resources_crm_select ON public.formula_calendar_resources;
CREATE POLICY formula_calendar_resources_crm_select ON public.formula_calendar_resources
  FOR SELECT TO authenticated
  USING (public.user_can_access_formula_crm());
