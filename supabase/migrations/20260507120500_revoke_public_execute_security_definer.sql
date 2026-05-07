-- Refuerzo de la migración 20260507120300: la causa real del flag
-- anon_security_definer_function_executable era el GRANT EXECUTE TO public
-- (rol que anon hereda). REVOKE FROM anon no toca el grant a public.
-- Acá hacemos REVOKE FROM public, manteniendo el grant explícito a authenticated
-- y service_role donde corresponda.
--
-- Las helper functions (current_tenant_id, current_user_role, current_is_legacy_protected)
-- son llamadas desde policies TO authenticated; mantienen GRANT a authenticated.
-- Las trigger functions (notify_*, sync_*, leads_set_created_by, handle_new_user*)
-- no se llaman vía RPC en la app; el REVOKE FROM public es la solución correcta.

REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.close_consignacion_pending_task() FROM public;
REVOKE EXECUTE ON FUNCTION public.complete_tenant_onboarding(text, text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.current_is_legacy_protected() FROM public;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM public;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM public;
REVOKE EXECUTE ON FUNCTION public.dispatch_webhook(text, uuid, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_sales_ranking(date, date, uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_signup() FROM public;
REVOKE EXECUTE ON FUNCTION public.invite_team_member(text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.lead_ingest_user_may_manage_branch(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.leads_set_created_by() FROM public;
REVOKE EXECUTE ON FUNCTION public.list_lead_ingest_keys(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.mint_lead_ingest_key(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_consignacion_created() FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_lead_assigned() FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_lead_contactado() FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_lead_sold() FROM public;
REVOKE EXECUTE ON FUNCTION public.notify_lead_sold_webhook() FROM public;
REVOKE EXECUTE ON FUNCTION public.provision_tenant(text, text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.resolve_notification_recipients(uuid, uuid, text[], uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.revoke_lead_ingest_key(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_appointment_duration() FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_appointment_to_pending_task() FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_stale_consignaciones_to_pending_tasks(integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.sync_stale_leads_to_pending_tasks(integer) FROM public;
