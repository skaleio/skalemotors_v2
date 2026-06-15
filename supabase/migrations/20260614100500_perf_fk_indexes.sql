-- ============================================================================
-- Hardening seguridad (2026-06-14) — índices en FKs sin cubrir
-- Cierra advisor unindexed_foreign_keys (22). Mejora joins/cascades y reduce
-- contención de locks ante carga elevada. Tablas de bajo volumen → CREATE INDEX
-- normal (atómico en la migración).
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_requested_by ON public.data_subject_requests (requested_by);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_tenant_id ON public.data_subject_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_branch_id ON public.document_templates (branch_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_category_id ON public.finance_expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_formula_appointments_lead_id ON public.formula_appointments (lead_id);
CREATE INDEX IF NOT EXISTS idx_formula_student_payments_student_id ON public.formula_student_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_lead_data_consents_recorded_by ON public.lead_data_consents (recorded_by);
CREATE INDEX IF NOT EXISTS idx_lead_notes_branch_id ON public.lead_notes (branch_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_by ON public.lead_notes (created_by);
CREATE INDEX IF NOT EXISTS idx_lead_notes_archive_archived_by ON public.lead_notes_archive (archived_by);
CREATE INDEX IF NOT EXISTS idx_lead_notes_archive_branch_id ON public.lead_notes_archive (branch_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_archive_created_by ON public.lead_notes_archive (created_by);
CREATE INDEX IF NOT EXISTS idx_seller_follow_up_checks_branch_id ON public.seller_follow_up_checks (branch_id);
CREATE INDEX IF NOT EXISTS idx_seller_follow_up_checks_checked_by ON public.seller_follow_up_checks (checked_by);
CREATE INDEX IF NOT EXISTS idx_seller_follow_up_notes_branch_id ON public.seller_follow_up_notes (branch_id);
CREATE INDEX IF NOT EXISTS idx_seller_follow_up_notes_seller_user_id ON public.seller_follow_up_notes (seller_user_id);
CREATE INDEX IF NOT EXISTS idx_seller_follow_up_notes_updated_by ON public.seller_follow_up_notes (updated_by);
CREATE INDEX IF NOT EXISTS idx_user_privacy_acceptances_policy_version_id ON public.user_privacy_acceptances (policy_version_id);
CREATE INDEX IF NOT EXISTS idx_user_privacy_acceptances_tenant_id ON public.user_privacy_acceptances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_status_events_branch_id ON public.vehicle_status_events (branch_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_status_events_changed_by ON public.vehicle_status_events (changed_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inboxes_connected_by ON public.whatsapp_inboxes (connected_by);
