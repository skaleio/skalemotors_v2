-- Sucursales: permitir crear/editar sin dirección, ciudad o región (solo nombre obligatorio en app).
-- Amplía quién puede insertar sucursales en su tenant (además de políticas permisivas heredadas).

ALTER TABLE public.branches
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN region DROP NOT NULL;

DROP POLICY IF EXISTS branches_insert_auth ON public.branches;
CREATE POLICY branches_insert_auth ON public.branches
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
    AND public.current_user_role() = ANY (
      ARRAY['admin', 'jefe_jefe', 'gerente', 'jefe_sucursal']::text[]
    )
  );

COMMENT ON COLUMN public.branches.address IS 'Dirección (opcional; completar cuando esté disponible)';
COMMENT ON COLUMN public.branches.city IS 'Ciudad (opcional)';
COMMENT ON COLUMN public.branches.region IS 'Región (opcional)';
