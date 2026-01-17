-- =====================================================
-- SCRIPT PARA CREAR USUARIOS DE PRUEBA
-- SKALEMOTORS - Crear usuarios para testing
-- =====================================================

-- IMPORTANTE: Este script debe ejecutarse DESPUÉS de aplicar fix_login_issue.sql

-- 1. Crear usuario administrador de prueba
-- Nota: Este usuario debe crearse primero en auth.users a través de la interfaz de Supabase
-- o usando la función de registro de la aplicación

-- 2. Una vez creado en auth.users, el trigger automáticamente creará el perfil en public.users
-- Si necesitas crear manualmente, usa este script:

-- Insertar usuario administrador (reemplaza el UUID con el real de auth.users)
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  branch_id,
  is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001', -- Reemplazar con UUID real
  'admin@skalemotors.cl',
  'Administrador Sistema',
  'admin',
  '550e8400-e29b-41d4-a716-446655440000',
  true
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  is_active = EXCLUDED.is_active;

-- Insertar usuario vendedor (reemplaza el UUID con el real de auth.users)
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  branch_id,
  is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002', -- Reemplazar con UUID real
  'vendedor@skalemotors.cl',
  'Vendedor Prueba',
  'vendedor',
  '550e8400-e29b-41d4-a716-446655440000',
  true
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  is_active = EXCLUDED.is_active;

-- 3. Verificar que los usuarios se crearon correctamente
SELECT 
    id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM public.users 
WHERE email IN ('admin@skalemotors.cl', 'vendedor@skalemotors.cl')
ORDER BY created_at DESC;
