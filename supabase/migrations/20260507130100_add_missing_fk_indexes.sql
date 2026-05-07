-- Performance fix: advisor unindexed_foreign_keys
-- 15 FKs sin índice. Sin índice los JOINs y CASCADE deletes hacen seq scan.

CREATE INDEX IF NOT EXISTS idx_documents_consignacion_id ON public.documents(consignacion_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON public.documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_sale_id ON public.documents(sale_id);
CREATE INDEX IF NOT EXISTS idx_documents_vehicle_id ON public.documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_gastos_empresa_created_by ON public.gastos_empresa(created_by);
CREATE INDEX IF NOT EXISTS idx_ingresos_empresa_branch_id ON public.ingresos_empresa(branch_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_empresa_sale_id ON public.ingresos_empresa(sale_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_user_id ON public.notifications(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_branch_id ON public.notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_pending_vendor_provisions_branch_id ON public.pending_vendor_provisions(branch_id);
CREATE INDEX IF NOT EXISTS idx_pending_vendor_provisions_tenant_id ON public.pending_vendor_provisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_branch_id ON public.tenant_invitations(branch_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_invited_by ON public.tenant_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_vehicle_appraisals_user_id ON public.vehicle_appraisals(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_endpoint_id ON public.webhook_log(endpoint_id);
