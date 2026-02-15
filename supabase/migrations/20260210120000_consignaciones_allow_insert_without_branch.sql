-- Permitir crear consignaciones sin sucursal asignada (branch_id NULL)
-- para usuarios autenticados que no tengan sucursal o para flexibilidad.
CREATE POLICY "Consignaciones insert sin sucursal"
ON public.consignaciones
FOR INSERT
TO authenticated
WITH CHECK (branch_id IS NULL);
