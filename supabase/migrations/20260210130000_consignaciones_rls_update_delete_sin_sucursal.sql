-- Permitir actualizar y eliminar consignaciones sin sucursal (branch_id NULL)
-- cuando el usuario es el creador (created_by = auth.uid()).

CREATE POLICY "Consignaciones update sin sucursal"
ON public.consignaciones
FOR UPDATE
TO authenticated
USING (branch_id IS NULL AND created_by = auth.uid())
WITH CHECK (branch_id IS NULL AND created_by = auth.uid());

CREATE POLICY "Consignaciones delete sin sucursal"
ON public.consignaciones
FOR DELETE
TO authenticated
USING (branch_id IS NULL AND created_by = auth.uid());
