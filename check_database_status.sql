-- =====================================================
-- SCRIPT PARA VERIFICAR EL ESTADO DE LA BASE DE DATOS
-- SKALEMOTORS - Diagnóstico del problema de login
-- =====================================================

-- 1. Verificar si existe la función handle_new_user
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') 
        THEN 'FUNCIÓN EXISTE' 
        ELSE 'FUNCIÓN NO EXISTE' 
    END as funcion_status;

-- 2. Verificar si existe el trigger
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') 
        THEN 'TRIGGER EXISTE' 
        ELSE 'TRIGGER NO EXISTE' 
    END as trigger_status;

-- 3. Verificar políticas RLS en la tabla users
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';

-- 4. Verificar si RLS está habilitado en la tabla users
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 5. Contar usuarios en la tabla public.users
SELECT COUNT(*) as total_users FROM public.users;

-- 6. Verificar usuarios de prueba
SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM public.users 
WHERE email IN ('admin@skalemotors.cl', 'vendedor@skalemotors.cl');

-- 7. Verificar sucursales
SELECT 
    id,
    name,
    city,
    region
FROM public.branches;

-- 8. Verificar usuarios en auth.users (si es posible)
SELECT COUNT(*) as auth_users_count FROM auth.users;
