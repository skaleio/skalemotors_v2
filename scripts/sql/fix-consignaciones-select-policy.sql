-- Ejecutar en Supabase SQL Editor si la app sigue mostrando 0 consignaciones
-- (equivale a la migración 20260701120000_consignaciones_select_authenticated.sql)

DROP POLICY IF EXISTS "consignaciones_select_authenticated" ON public.consignaciones;
CREATE POLICY "consignaciones_select_authenticated"
ON public.consignaciones
FOR SELECT
TO authenticated
USING (true);
