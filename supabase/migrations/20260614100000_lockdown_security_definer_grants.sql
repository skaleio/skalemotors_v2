-- ============================================================================
-- Hardening seguridad (2026-06-14) — lockdown de EXECUTE en SECURITY DEFINER
-- Cierra advisors: anon_security_definer_function_executable,
-- function_search_path_mutable, y 2 hallazgos de escalada (provision_tenant,
-- dispatch_webhook ejecutables por authenticated sin check de rol).
-- Idempotente. Solo toca grants y search_path; no reescribe cuerpos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Funciones trigger: nadie debe poder invocarlas como RPC.
--    (Los triggers siguen disparando: no requieren EXECUTE para el caller.)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.archive_lead_note_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_lead_note_change() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_lead_note_vendor_source() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_lead_note_vendor_source() TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Helpers / RPCs de uso autenticado: quitar anon (heredado por default).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_user_branch_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_branch_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_seller_engagement_metrics(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_engagement_metrics(uuid, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_branch_sales_staff_profile(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_branch_sales_staff_profile(uuid, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.upsert_seller_app_presence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_seller_app_presence(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_seller_inactivity_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_seller_inactivity_notifications() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Escalada de privilegios: operaciones que solo debe correr service_role
--    (provisioning vía script; dispatch desde triggers/Edge Functions).
--    provision_tenant no valida rol interno → authenticated podía crear tenant
--    y auto-asignarse admin. dispatch_webhook acepta tenant/payload arbitrarios.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.provision_tenant(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tenant(text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.dispatch_webhook(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_webhook(text, uuid, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) search_path inmutable (function_search_path_mutable)
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.vehicles_clear_publicado_web_on_terminal_status() SET search_path = public, pg_temp;
ALTER FUNCTION public.vehicle_status_display_label(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.lead_source_display_label(text) SET search_path = public, pg_temp;

-- Nota: formula_book_appointment / formula_cancel_appointment /
-- formula_get_available_slots SIGUEN con EXECUTE para anon a propósito
-- (booking público del landing Fórmula Miami). El abuso se mitiga con
-- rate-limit en 20260614100200_rate_limit_infra.sql.
