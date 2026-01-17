-- =====================================================
-- Script para crear usuario de prueba con onboarding
-- =====================================================

-- Primero, asegurémonos de que el campo existe
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Crear un usuario de prueba (reemplaza con tus datos)
-- NOTA: Este usuario debe existir primero en auth.users
INSERT INTO public.users (
    id,
    email,
    full_name,
    phone,
    role,
    is_active,
    onboarding_completed,
    created_at,
    updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000', -- ID del usuario de auth.users
    'test@skalemotors.com',
    'Usuario de Prueba',
    '+56 9 1234 5678',
    'admin',
    true,
    false, -- Este usuario necesitará onboarding
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    onboarding_completed = false,
    updated_at = NOW();

-- Verificar que el usuario fue creado/actualizado
SELECT 
    id,
    email,
    full_name,
    role,
    onboarding_completed,
    created_at
FROM public.users 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Crear otro usuario que ya completó el onboarding
INSERT INTO public.users (
    id,
    email,
    full_name,
    phone,
    role,
    is_active,
    onboarding_completed,
    created_at,
    updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001', -- ID diferente
    'admin@skalemotors.com',
    'Administrador',
    '+56 9 8765 4321',
    'admin',
    true,
    true, -- Este usuario ya completó el onboarding
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    onboarding_completed = true,
    updated_at = NOW();

-- Ver todos los usuarios
SELECT 
    id,
    email,
    full_name,
    role,
    onboarding_completed,
    created_at
FROM public.users 
ORDER BY created_at DESC;
