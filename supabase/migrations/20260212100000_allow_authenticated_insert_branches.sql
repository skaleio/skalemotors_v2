-- Permitir que usuarios autenticados creen sucursales (ej. "Agregar sucursal" en Configuración).
-- No permite UPDATE/DELETE; solo INSERT para que el usuario pueda asignarse una sucursal nueva.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branches' AND policyname = 'allow_authenticated_insert_branches'
  ) THEN
    CREATE POLICY "allow_authenticated_insert_branches"
    ON public.branches
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  END IF;
END $$;
