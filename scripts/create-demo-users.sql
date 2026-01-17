-- =====================================================
-- Script para Crear Usuarios de Demo
-- SKALEMOTORS - Ecosistema Automotriz #1
-- =====================================================
--
-- Este script crea usuarios de demostración para testing
-- IMPORTANTE: Solo usar en ambiente de desarrollo/demo
-- =====================================================

-- NOTA: Los usuarios deben crearse primero en auth.users usando Supabase Auth
-- Este script asume que los usuarios ya existen en auth.users
-- y solo crea los perfiles en public.users

-- Para crear usuarios en auth.users, usar la API de Supabase o el dashboard

-- =====================================================
-- USUARIOS DE DEMO
-- =====================================================

-- Usuario Admin de Demo
-- Email: demo@skale.io
-- Password: demo123
-- (Crear primero en auth.users con Supabase Auth)

-- Usuario Vendedor de Demo
-- Email: vendedor@skale.io
-- Password: demo123
-- (Crear primero en auth.users con Supabase Auth)

-- Usuario Gerente de Demo
-- Email: gerente@skale.io
-- Password: demo123
-- (Crear primero en auth.users con Supabase Auth)

-- =====================================================
-- EJEMPLO: Insertar perfil después de crear en auth.users
-- =====================================================

-- Reemplazar 'USER_ID_FROM_AUTH' con el ID real del usuario creado en auth.users

/*
INSERT INTO public.users (
    id,
    email,
    full_name,
    phone,
    role,
    branch_id,
    is_active,
    onboarding_completed
) VALUES
(
    'USER_ID_FROM_AUTH', -- Reemplazar con ID real
    'demo@skale.io',
    'Usuario Demo Admin',
    '+56912345678',
    'admin',
    '550e8400-e29b-41d4-a716-446655440000', -- Sucursal Providencia
    true,
    true
),
(
    'USER_ID_FROM_AUTH_2', -- Reemplazar con ID real
    'vendedor@skale.io',
    'Usuario Demo Vendedor',
    '+56987654321',
    'vendedor',
    '550e8400-e29b-41d4-a716-446655440000',
    true,
    true
),
(
    'USER_ID_FROM_AUTH_3', -- Reemplazar con ID real
    'gerente@skale.io',
    'Usuario Demo Gerente',
    '+56911223344',
    'gerente',
    '550e8400-e29b-41d4-a716-446655440000',
    true,
    true
)
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
*/

-- =====================================================
-- VERIFICAR USUARIOS CREADOS
-- =====================================================

SELECT 
    id,
    email,
    full_name,
    role,
    branch_id,
    is_active,
    onboarding_completed
FROM public.users
ORDER BY created_at DESC;


