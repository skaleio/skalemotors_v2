-- Permitir a todos los usuarios autenticados ver todas las consignaciones.
-- Sin esta política, RLS puede impedir que se listen los registros (p. ej. hessen@test.io ve 0).
-- Mismo criterio que vehicles: usuarios autenticados pueden SELECT.

DROP POLICY IF EXISTS "consignaciones_select_authenticated" ON public.consignaciones;
CREATE POLICY "consignaciones_select_authenticated"
ON public.consignaciones
FOR SELECT
TO authenticated
USING (true);
