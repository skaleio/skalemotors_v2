-- Permitir que usuarios actualicen su propia sucursal en casos controlados:
-- 1) Primera asignación (branch_id anterior NULL) a una sucursal del mismo tenant.
-- 2) Administradores y jefe_jefe pueden cambiar a cualquier sucursal activa de su tenant (o NULL).

DROP POLICY IF EXISTS users_update_self_safe ON public.users;
CREATE POLICY users_update_self_safe ON public.users
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    AND (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  )
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND tenant_id IS NOT DISTINCT FROM (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND legacy_protected = (SELECT legacy_protected FROM public.users WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
    AND (
      branch_id IS NOT DISTINCT FROM (SELECT branch_id FROM public.users WHERE id = auth.uid())
      OR (
        (SELECT branch_id FROM public.users WHERE id = auth.uid()) IS NULL
        AND branch_id IS NOT NULL
        AND branch_id IN (
          SELECT b.id
          FROM public.branches b
          WHERE b.is_active = true
            AND b.tenant_id IS NOT DISTINCT FROM (
              SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid()
            )
        )
      )
      OR (
        public.current_user_role() IN ('admin', 'jefe_jefe')
        AND (
          branch_id IS NULL
          OR branch_id IN (
            SELECT b.id
            FROM public.branches b
            WHERE b.is_active = true
              AND b.tenant_id IS NOT DISTINCT FROM (
                SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid()
              )
          )
        )
      )
    )
  );
