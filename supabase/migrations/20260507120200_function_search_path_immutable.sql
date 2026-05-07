-- Fix advisor: function_search_path_mutable
-- Hardenea las 6 funciones con search_path mutable, mitiga riesgo de privilege escalation
-- via search_path manipulation. Solo agrega config, no modifica el cuerpo.

ALTER FUNCTION public.set_updated_at_gastos_empresa() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_documents_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at_salary_distribution() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at_ai_conversations() SET search_path = public, pg_temp;
ALTER FUNCTION public.leads_sync_closed_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.lead_ingest_keys_branch_tenant_match() SET search_path = public, pg_temp;
