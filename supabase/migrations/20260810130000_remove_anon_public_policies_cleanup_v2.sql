-- ============================================================================
-- CLEANUP: Reemplazar TODAS las policies public/anon con authenticated
-- Asegura que NINGUN usuario no autenticado pueda acceder a datos
-- ============================================================================

-- === SALES ===
DROP POLICY IF EXISTS sales_insert_anon ON public.sales;
DROP POLICY IF EXISTS sales_delete_all ON public.sales;

-- === SALE_EXPENSES ===
DROP POLICY IF EXISTS sale_expenses_insert_anon ON public.sale_expenses;

-- === VEHICLES ===
DROP POLICY IF EXISTS vehicles_select_all ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update_authenticated ON public.vehicles;
DROP POLICY IF EXISTS vehicles_insert_authenticated ON public.vehicles;
DROP POLICY IF EXISTS vehicles_delete_authenticated ON public.vehicles;
DROP POLICY IF EXISTS vehicles_select_auth ON public.vehicles;
DROP POLICY IF EXISTS vehicles_insert_auth ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update_auth ON public.vehicles;
DROP POLICY IF EXISTS vehicles_delete_auth ON public.vehicles;

CREATE POLICY vehicles_select_auth ON public.vehicles
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY vehicles_insert_auth ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY vehicles_update_auth ON public.vehicles
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY vehicles_delete_auth ON public.vehicles
  FOR DELETE TO authenticated
  USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','gerente','jefe_jefe'));

-- === LEADS ===
DROP POLICY IF EXISTS leads_select_assigned ON public.leads;
DROP POLICY IF EXISTS leads_insert_assigned ON public.leads;
DROP POLICY IF EXISTS leads_update_assigned ON public.leads;
DROP POLICY IF EXISTS leads_delete_assigned ON public.leads;
DROP POLICY IF EXISTS leads_select_auth ON public.leads;
DROP POLICY IF EXISTS leads_insert_auth ON public.leads;
DROP POLICY IF EXISTS leads_update_auth ON public.leads;
DROP POLICY IF EXISTS leads_delete_auth ON public.leads;

CREATE POLICY leads_select_auth ON public.leads
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY leads_insert_auth ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY leads_update_auth ON public.leads
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY leads_delete_auth ON public.leads
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

-- === BRANCHES ===
DROP POLICY IF EXISTS branches_admin_insert ON public.branches;
DROP POLICY IF EXISTS branches_admin_update ON public.branches;
DROP POLICY IF EXISTS branches_admin_delete ON public.branches;
DROP POLICY IF EXISTS branches_insert_auth ON public.branches;
DROP POLICY IF EXISTS branches_update_auth ON public.branches;
DROP POLICY IF EXISTS branches_delete_auth ON public.branches;

CREATE POLICY branches_insert_auth ON public.branches
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','jefe_jefe'));
CREATE POLICY branches_update_auth ON public.branches
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY branches_delete_auth ON public.branches
  FOR DELETE TO authenticated
  USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','jefe_jefe'));

-- === DOCUMENTS ===
DROP POLICY IF EXISTS documents_select_branch ON public.documents;
DROP POLICY IF EXISTS documents_insert_authenticated ON public.documents;
DROP POLICY IF EXISTS documents_update_own ON public.documents;
DROP POLICY IF EXISTS documents_delete_admin ON public.documents;
DROP POLICY IF EXISTS documents_select_auth ON public.documents;
DROP POLICY IF EXISTS documents_insert_auth ON public.documents;
DROP POLICY IF EXISTS documents_update_auth ON public.documents;
DROP POLICY IF EXISTS documents_delete_auth ON public.documents;

CREATE POLICY documents_select_auth ON public.documents
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY documents_insert_auth ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY documents_update_auth ON public.documents
  FOR UPDATE TO authenticated
  USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND (created_by = auth.uid() OR public.current_user_role() IN ('admin','gerente','jefe_jefe')));
CREATE POLICY documents_delete_auth ON public.documents
  FOR DELETE TO authenticated
  USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','gerente','jefe_jefe'));

-- === MESSAGES ===
DROP POLICY IF EXISTS messages_select_branch ON public.messages;
DROP POLICY IF EXISTS messages_insert_outgoing_self ON public.messages;
DROP POLICY IF EXISTS messages_select_auth ON public.messages;
DROP POLICY IF EXISTS messages_insert_auth ON public.messages;

CREATE POLICY messages_select_auth ON public.messages
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY messages_insert_auth ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

-- === PENDING_TASKS ===
DROP POLICY IF EXISTS "Users can view pending_tasks of their branch" ON public.pending_tasks;
DROP POLICY IF EXISTS "Users can insert pending_tasks for their branch" ON public.pending_tasks;
DROP POLICY IF EXISTS "Users can update pending_tasks of their branch" ON public.pending_tasks;
DROP POLICY IF EXISTS "Users can delete pending_tasks of their branch" ON public.pending_tasks;
DROP POLICY IF EXISTS pending_tasks_select_auth ON public.pending_tasks;
DROP POLICY IF EXISTS pending_tasks_insert_auth ON public.pending_tasks;
DROP POLICY IF EXISTS pending_tasks_update_auth ON public.pending_tasks;
DROP POLICY IF EXISTS pending_tasks_delete_auth ON public.pending_tasks;

CREATE POLICY pending_tasks_select_auth ON public.pending_tasks
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY pending_tasks_insert_auth ON public.pending_tasks
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY pending_tasks_update_auth ON public.pending_tasks
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY pending_tasks_delete_auth ON public.pending_tasks
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

-- === MARKETPLACE_CONNECTIONS ===
DROP POLICY IF EXISTS marketplace_connections_select ON public.marketplace_connections;
DROP POLICY IF EXISTS marketplace_connections_insert ON public.marketplace_connections;
DROP POLICY IF EXISTS marketplace_connections_update ON public.marketplace_connections;
DROP POLICY IF EXISTS marketplace_connections_delete ON public.marketplace_connections;
DROP POLICY IF EXISTS marketplace_connections_select_auth ON public.marketplace_connections;
DROP POLICY IF EXISTS marketplace_connections_insert_auth ON public.marketplace_connections;
DROP POLICY IF EXISTS marketplace_connections_update_auth ON public.marketplace_connections;
DROP POLICY IF EXISTS marketplace_connections_delete_auth ON public.marketplace_connections;

CREATE POLICY marketplace_connections_select_auth ON public.marketplace_connections
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY marketplace_connections_insert_auth ON public.marketplace_connections
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','jefe_jefe'));
CREATE POLICY marketplace_connections_update_auth ON public.marketplace_connections
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY marketplace_connections_delete_auth ON public.marketplace_connections
  FOR DELETE TO authenticated
  USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','jefe_jefe'));

-- === N8N_WORKSPACES ===
DROP POLICY IF EXISTS "Users can view their branch n8n config" ON public.n8n_workspaces;
DROP POLICY IF EXISTS "Only admins can insert n8n config" ON public.n8n_workspaces;
DROP POLICY IF EXISTS "Admins and managers can update n8n config" ON public.n8n_workspaces;
DROP POLICY IF EXISTS "Only admins can delete n8n config" ON public.n8n_workspaces;
DROP POLICY IF EXISTS n8n_workspaces_select_auth ON public.n8n_workspaces;
DROP POLICY IF EXISTS n8n_workspaces_insert_auth ON public.n8n_workspaces;
DROP POLICY IF EXISTS n8n_workspaces_update_auth ON public.n8n_workspaces;
DROP POLICY IF EXISTS n8n_workspaces_delete_auth ON public.n8n_workspaces;

CREATE POLICY n8n_workspaces_select_auth ON public.n8n_workspaces
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY n8n_workspaces_insert_auth ON public.n8n_workspaces
  FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','jefe_jefe'));
CREATE POLICY n8n_workspaces_update_auth ON public.n8n_workspaces
  FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY n8n_workspaces_delete_auth ON public.n8n_workspaces
  FOR DELETE TO authenticated USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','jefe_jefe'));

-- === N8N_WORKFLOW_EXECUTIONS ===
DROP POLICY IF EXISTS "Users can view their branch workflow executions" ON public.n8n_workflow_executions;
DROP POLICY IF EXISTS n8n_executions_select_auth ON public.n8n_workflow_executions;

CREATE POLICY n8n_executions_select_auth ON public.n8n_workflow_executions
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

-- === VEHICLE_LISTINGS ===
DROP POLICY IF EXISTS vehicle_listings_select ON public.vehicle_listings;
DROP POLICY IF EXISTS vehicle_listings_insert ON public.vehicle_listings;
DROP POLICY IF EXISTS vehicle_listings_update ON public.vehicle_listings;
DROP POLICY IF EXISTS vehicle_listings_delete ON public.vehicle_listings;
DROP POLICY IF EXISTS vehicle_listings_select_auth ON public.vehicle_listings;
DROP POLICY IF EXISTS vehicle_listings_insert_auth ON public.vehicle_listings;
DROP POLICY IF EXISTS vehicle_listings_update_auth ON public.vehicle_listings;
DROP POLICY IF EXISTS vehicle_listings_delete_auth ON public.vehicle_listings;

CREATE POLICY vehicle_listings_select_auth ON public.vehicle_listings
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY vehicle_listings_insert_auth ON public.vehicle_listings
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY vehicle_listings_update_auth ON public.vehicle_listings
  FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY vehicle_listings_delete_auth ON public.vehicle_listings
  FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

-- === WHATSAPP_CALLS ===
DROP POLICY IF EXISTS "Users can view calls from their branch" ON public.whatsapp_calls;
DROP POLICY IF EXISTS "Users can create calls" ON public.whatsapp_calls;
DROP POLICY IF EXISTS "Users can update calls from their branch" ON public.whatsapp_calls;
DROP POLICY IF EXISTS whatsapp_calls_select_auth ON public.whatsapp_calls;
DROP POLICY IF EXISTS whatsapp_calls_insert_auth ON public.whatsapp_calls;
DROP POLICY IF EXISTS whatsapp_calls_update_auth ON public.whatsapp_calls;

CREATE POLICY whatsapp_calls_select_auth ON public.whatsapp_calls
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY whatsapp_calls_insert_auth ON public.whatsapp_calls
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());
CREATE POLICY whatsapp_calls_update_auth ON public.whatsapp_calls
  FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected());

-- === WHATSAPP_INBOXES ===
DROP POLICY IF EXISTS whatsapp_inboxes_select_admin_manager ON public.whatsapp_inboxes;
DROP POLICY IF EXISTS whatsapp_inboxes_admin_insert ON public.whatsapp_inboxes;
DROP POLICY IF EXISTS whatsapp_inboxes_admin_update ON public.whatsapp_inboxes;
DROP POLICY IF EXISTS whatsapp_inboxes_admin_delete ON public.whatsapp_inboxes;
DROP POLICY IF EXISTS whatsapp_inboxes_select_auth ON public.whatsapp_inboxes;
DROP POLICY IF EXISTS whatsapp_inboxes_insert_auth ON public.whatsapp_inboxes;
DROP POLICY IF EXISTS whatsapp_inboxes_update_auth ON public.whatsapp_inboxes;
DROP POLICY IF EXISTS whatsapp_inboxes_delete_auth ON public.whatsapp_inboxes;

CREATE POLICY whatsapp_inboxes_select_auth ON public.whatsapp_inboxes
  FOR SELECT TO authenticated USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() IN ('admin','gerente'));
CREATE POLICY whatsapp_inboxes_insert_auth ON public.whatsapp_inboxes
  FOR INSERT TO authenticated WITH CHECK ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() = 'admin');
CREATE POLICY whatsapp_inboxes_update_auth ON public.whatsapp_inboxes
  FOR UPDATE TO authenticated USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() = 'admin');
CREATE POLICY whatsapp_inboxes_delete_auth ON public.whatsapp_inboxes
  FOR DELETE TO authenticated USING ((tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected()) AND public.current_user_role() = 'admin');

-- === USER_SHORTCUT_PREFERENCES ===
DROP POLICY IF EXISTS "Users can read own shortcut preferences" ON public.user_shortcut_preferences;
DROP POLICY IF EXISTS "Users can insert own shortcut preferences" ON public.user_shortcut_preferences;
DROP POLICY IF EXISTS "Users can update own shortcut preferences" ON public.user_shortcut_preferences;
DROP POLICY IF EXISTS "Users can delete own shortcut preferences" ON public.user_shortcut_preferences;
DROP POLICY IF EXISTS shortcut_prefs_select ON public.user_shortcut_preferences;
DROP POLICY IF EXISTS shortcut_prefs_insert ON public.user_shortcut_preferences;
DROP POLICY IF EXISTS shortcut_prefs_update ON public.user_shortcut_preferences;
DROP POLICY IF EXISTS shortcut_prefs_delete ON public.user_shortcut_preferences;

CREATE POLICY shortcut_prefs_select ON public.user_shortcut_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY shortcut_prefs_insert ON public.user_shortcut_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY shortcut_prefs_update ON public.user_shortcut_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY shortcut_prefs_delete ON public.user_shortcut_preferences
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- === USERS: eliminar policies public sobrantes ===
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
