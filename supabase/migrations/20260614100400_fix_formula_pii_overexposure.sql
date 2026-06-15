-- ============================================================================
-- Hardening seguridad (2026-06-14) — corregir sobre-exposición de PII
-- Las policies *_crm_select tenían USING (true): CUALQUIER usuario autenticado
-- (de cualquier tenant) podía leer alumnos y pagos de Fórmula Miami.
-- Se eliminan; la policy *_crm_rw (FOR ALL, user_can_access_formula_crm())
-- ya cubre el SELECT para usuarios autorizados del CRM.
-- También resuelve el lint multiple_permissive_policies en estas tablas.
-- ============================================================================

DROP POLICY IF EXISTS formula_students_crm_select ON public.formula_students;
DROP POLICY IF EXISTS formula_student_payments_crm_select ON public.formula_student_payments;
