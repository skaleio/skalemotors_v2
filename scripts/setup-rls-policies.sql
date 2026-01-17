-- =====================================================
-- Configuración Mejorada de Row Level Security (RLS)
-- SKALEMOTORS - Ecosistema Automotriz #1
-- =====================================================
--
-- Este script mejora las políticas RLS existentes
-- para mayor seguridad y control de acceso
-- =====================================================

-- =====================================================
-- POLÍTICAS MEJORADAS PARA USUARIOS
-- =====================================================

-- Eliminar políticas existentes si es necesario
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Usuarios pueden ver su propio perfil
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT
    USING (auth.uid() = id);

-- Usuarios pueden actualizar su propio perfil (excepto role)
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        -- No permitir cambiar role a menos que sea admin
        (role = (SELECT role FROM public.users WHERE id = auth.uid()) OR
         EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    );

-- Admins y gerentes pueden ver todos los usuarios de su sucursal
CREATE POLICY "managers_view_branch_users" ON public.users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'gerente')
            AND (
                u.role = 'admin' OR
                u.branch_id = users.branch_id
            )
        )
    );

-- Admins pueden insertar usuarios
CREATE POLICY "admins_insert_users" ON public.users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- POLÍTICAS MEJORADAS PARA VEHÍCULOS
-- =====================================================

DROP POLICY IF EXISTS "Users can view vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Staff can manage vehicles" ON public.vehicles;

-- Todos los usuarios autenticados pueden ver vehículos
CREATE POLICY "vehicles_select_all" ON public.vehicles
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Solo staff autorizado puede insertar/actualizar vehículos
CREATE POLICY "vehicles_manage_staff" ON public.vehicles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente', 'inventario')
            AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente', 'inventario')
            AND is_active = true
        )
    );

-- =====================================================
-- POLÍTICAS MEJORADAS PARA LEADS
-- =====================================================

DROP POLICY IF EXISTS "Users can view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Users can manage assigned leads" ON public.leads;

-- Usuarios pueden ver leads asignados a ellos
CREATE POLICY "leads_select_assigned" ON public.leads
    FOR SELECT
    USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente')
        )
    );

-- Usuarios pueden crear leads
CREATE POLICY "leads_insert_users" ON public.leads
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND
        (
            assigned_to = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid()
                AND role IN ('admin', 'gerente')
            )
        )
    );

-- Usuarios pueden actualizar leads asignados a ellos
CREATE POLICY "leads_update_assigned" ON public.leads
    FOR UPDATE
    USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente')
        )
    )
    WITH CHECK (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente')
        )
    );

-- =====================================================
-- POLÍTICAS MEJORADAS PARA VENTAS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own sales" ON public.sales;
DROP POLICY IF EXISTS "Users can create sales" ON public.sales;

-- Usuarios pueden ver sus propias ventas o todas si son admin/gerente
CREATE POLICY "sales_select_own_or_all" ON public.sales
    FOR SELECT
    USING (
        seller_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente')
        )
    );

-- Solo vendedores, gerentes y admins pueden crear ventas
CREATE POLICY "sales_insert_authorized" ON public.sales
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente', 'vendedor')
            AND is_active = true
        ) AND
        (
            seller_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid()
                AND role IN ('admin', 'gerente')
            )
        )
    );

-- =====================================================
-- POLÍTICAS PARA CITAS
-- =====================================================

-- Usuarios pueden ver citas donde son participantes o asignados
CREATE POLICY "appointments_select_participants" ON public.appointments
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente')
        )
    );

-- Usuarios pueden crear citas
CREATE POLICY "appointments_insert_users" ON public.appointments
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND
        (
            user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid()
                AND role IN ('admin', 'gerente')
            )
        )
    );

-- =====================================================
-- POLÍTICAS PARA COTIZACIONES
-- =====================================================

-- Usuarios pueden ver cotizaciones donde son el vendedor
CREATE POLICY "quotes_select_own" ON public.quotes
    FOR SELECT
    USING (
        seller_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente')
        )
    );

-- Vendedores pueden crear cotizaciones
CREATE POLICY "quotes_insert_sellers" ON public.quotes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('admin', 'gerente', 'vendedor')
            AND is_active = true
        ) AND
        seller_id = auth.uid()
    );

-- =====================================================
-- VERIFICAR POLÍTICAS
-- =====================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


