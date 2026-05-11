-- ============================================================================
-- Quick wins de seguridad sobre los advisors de Supabase (2026-05-11).
-- Resuelve 5 hallazgos concretos:
--
-- (A) expense_types INSERT permitía a cualquier authenticated insertar tipos
--     en el catálogo global (WITH CHECK true). Restringimos a admin/jefe_jefe
--     siguiendo el patrón ya usado en expense_types_update_admin/_delete_admin.
--
-- (B) pending_vendor_provisions tiene RLS habilitado y 0 policies. Es
--     intencional (sólo service_role escribe; trigger on_auth_user_created
--     lee), pero el advisor marca rls_enabled_no_policy. Agregamos policy
--     deny-all explícita + COMMENT documentando el contrato.
--
-- (C) Storage bucket público `vehicles` tenía policy `vehicles_authenticated_list`
--     que permitía a cualquier authenticated listar TODOS los archivos del
--     bucket (cross-tenant). Como el bucket es público, las URLs directas
--     siguen funcionando sin necesidad de listing.
--
-- (D) is_admin_of_branch(uuid, uuid) era ejecutable por anon. Es la única
--     función SECURITY DEFINER con execute para anon en el schema. Revocamos.
--
-- (E) Triggers SECURITY DEFINER expuestos como RPC vía PostgREST. Las
--     migraciones 20260507120300/120500 revocaron `anon` y `public`, pero
--     el rol `authenticated` mantiene EXECUTE explícito. Estas funciones
--     son disparadas por triggers DML; el rol del cliente es irrelevante.
--     No hay caso de uso legítimo donde un cliente las llame vía /rest/v1/rpc.
-- ============================================================================

-- (A) expense_types INSERT --------------------------------------------------
drop policy if exists "Allow insert expense_types for authenticated" on public.expense_types;

create policy expense_types_insert_admin on public.expense_types
  for insert to authenticated
  with check (public.current_user_role() = any (array['admin', 'jefe_jefe']));

-- (B) pending_vendor_provisions deny-all -----------------------------------
drop policy if exists pending_vendor_provisions_deny_all on public.pending_vendor_provisions;

create policy pending_vendor_provisions_deny_all on public.pending_vendor_provisions
  for all to authenticated, anon
  using (false) with check (false);

comment on table public.pending_vendor_provisions is
  'Cola de alta de vendedores. Sólo service_role escribe (Edge Function vendor-user-create); '
  'trigger on_auth_user_created lee al crear el usuario en auth.users. '
  'RLS deny-all explícito por diseño — ningún cliente debe leer/escribir directo.';

-- (C) Storage: drop vehicles_authenticated_list ----------------------------
drop policy if exists vehicles_authenticated_list on storage.objects;

-- (D) is_admin_of_branch revoke from anon ----------------------------------
revoke execute on function public.is_admin_of_branch(uuid, uuid) from anon;

-- (E) Triggers SECURITY DEFINER: revoke from authenticated -----------------
-- handle_new_user* corren al INSERT en auth.users (trigger on_auth_user_created).
-- leads_set_created_by, notify_*, sync_appointment_* corren en triggers DML.
-- close_consignacion_pending_task corre en trigger UPDATE consignaciones.
-- rls_auto_enable es helper administrativo (no se llama vía REST).
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user_signup() from authenticated;
revoke execute on function public.leads_set_created_by() from authenticated;
revoke execute on function public.notify_lead_assigned() from authenticated;
revoke execute on function public.notify_lead_contactado() from authenticated;
revoke execute on function public.notify_lead_sold() from authenticated;
revoke execute on function public.notify_lead_sold_webhook() from authenticated;
revoke execute on function public.notify_consignacion_created() from authenticated;
revoke execute on function public.sync_appointment_duration() from authenticated;
revoke execute on function public.sync_appointment_to_pending_task() from authenticated;
revoke execute on function public.close_consignacion_pending_task() from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
