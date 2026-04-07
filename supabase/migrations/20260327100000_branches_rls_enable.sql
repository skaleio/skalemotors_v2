-- ============================================================================
-- Fix: Activar RLS en tabla branches + política SELECT permisiva
-- Regla: hessen@test.io tiene legacy_protected=true → pasa tenant_restrict_branches
--        sin verificar tenant_id (cortocircuito en current_is_legacy_protected())
-- ============================================================================

-- Activar RLS (las políticas existentes solo aplican cuando RLS está ON)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Política permisiva SELECT base (necesaria para que la restrictiva tenga efecto)
-- Sin al menos una política permisiva, RLS bloquea todo por defecto
DROP POLICY IF EXISTS branches_select_authenticated ON public.branches;
CREATE POLICY branches_select_authenticated ON public.branches
  FOR SELECT TO authenticated
  USING (true);

-- Verificar que la política restrictiva ya existe (creada en migración anterior)
-- Si no existe por algún motivo, la creamos aquí también
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'branches'
      AND policyname = 'tenant_restrict_branches'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY tenant_restrict_branches ON public.branches
        AS RESTRICTIVE FOR ALL TO authenticated
        USING (
          public.current_is_legacy_protected()
          OR tenant_id = public.current_tenant_id()
        )
    $policy$;
  END IF;
END $$;
