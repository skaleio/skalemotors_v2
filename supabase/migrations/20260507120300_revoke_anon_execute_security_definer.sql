-- Fix advisor: anon_security_definer_function_executable
-- Las 28 funciones SECURITY DEFINER en public schema no tienen ningun caso de uso
-- legitimo donde el rol anon necesite ejecutarlas:
--   - Las RPC (mint/list/revoke_lead_ingest_key, accept_invitation, etc.) requieren JWT.
--   - Los helpers (current_tenant_id, current_user_role, current_is_legacy_protected)
--     son llamados desde policies TO authenticated; anon nunca dispara esas policies.
--   - Los triggers (notify_*, sync_*, set_updated_at_*, handle_new_user*, etc.)
--     son invocados por triggers DML, no por clientes; el rol del cliente es irrelevante.
-- Revocamos EXECUTE de anon para reducir la superficie de ataque.

REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_consignacion_pending_task() FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_tenant_onboarding(text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_is_legacy_protected() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_webhook(text, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_sales_ranking(date, date, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_signup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.invite_team_member(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lead_ingest_user_may_manage_branch(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.leads_set_created_by() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_lead_ingest_keys(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mint_lead_ingest_key(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_consignacion_created() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_lead_assigned() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_lead_contactado() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_lead_sold() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_lead_sold_webhook() FROM anon;
REVOKE EXECUTE ON FUNCTION public.provision_tenant(text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_notification_recipients(uuid, uuid, text[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_lead_ingest_key(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_appointment_duration() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_appointment_to_pending_task() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_stale_consignaciones_to_pending_tasks(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_stale_leads_to_pending_tasks(integer) FROM anon;
