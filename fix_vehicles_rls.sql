-- =====================================================
-- FIX: Políticas RLS para tabla vehicles
-- Permite DELETE, INSERT, UPDATE a usuarios autorizados
-- =====================================================

-- 1. Eliminar políticas existentes de vehicles si existen
DROP POLICY IF EXISTS "Users can view vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Staff can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_select_all" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_manage_staff" ON public.vehicles;

-- 2. Asegurar que RLS está habilitado
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- 3. Política para SELECT: Todos los usuarios autenticados pueden ver vehículos
CREATE POLICY "vehicles_select_all" ON public.vehicles
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 4. Política para INSERT: Solo staff autorizado puede insertar
CREATE POLICY "vehicles_insert_staff" ON public.vehicles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente', 'inventario', 'vendedor')
            AND is_active = true
        )
    );

-- 5. Política para UPDATE: Solo staff autorizado puede actualizar
CREATE POLICY "vehicles_update_staff" ON public.vehicles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente', 'inventario', 'vendedor')
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente', 'inventario', 'vendedor')
            AND is_active = true
        )
    );

-- 6. Política para DELETE: Solo admin, gerente e inventario pueden eliminar
CREATE POLICY "vehicles_delete_staff" ON public.vehicles
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente', 'inventario')
            AND is_active = true
        )
    );

-- 7. Verificar políticas creadas
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'vehicles'
ORDER BY policyname;

-- 8. Mensaje de confirmación
SELECT '✅ Políticas RLS para vehicles configuradas correctamente' as status;

