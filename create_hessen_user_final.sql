-- =====================================================
-- CREAR USUARIO hessen@test.io CORRECTAMENTE
-- SKALEMOTORS - Ejecutar DESPUÉS de setup_complete_rls.sql
-- =====================================================

-- 1. Confirmar email en auth.users
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'hessen@test.io';

-- 2. Deshabilitar RLS temporalmente para insertar manualmente
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 3. Insertar o actualizar usuario usando subconsulta
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  branch_id,
  is_active,
  onboarding_completed,
  created_at,
  updated_at
)
SELECT 
  au.id,
  'hessen@test.io',
  'Hessen',
  'admin',
  '550e8400-e29b-41d4-a716-446655440000',
  true,
  true,
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email = 'hessen@test.io'
ON CONFLICT (id) 
DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  is_active = true,
  onboarding_completed = true,
  updated_at = NOW();

-- 4. Rehabilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Verificar que se creó correctamente
SELECT 
  '✅ VERIFICACIÓN USUARIO' as status,
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.onboarding_completed,
  b.name as branch_name,
  CASE 
    WHEN au.email_confirmed_at IS NOT NULL THEN '✅ Confirmado'
    ELSE '❌ No confirmado'
  END as email_status
FROM public.users u
LEFT JOIN public.branches b ON u.branch_id = b.id
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'hessen@test.io';

