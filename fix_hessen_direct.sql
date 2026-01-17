-- =====================================================
-- SCRIPT DIRECTO PARA CREAR USUARIO hessen@test.io
-- SKALEMOTORS - Sin bloques DO, todo directo
-- =====================================================

-- PASO 1: Obtener el ID del usuario de auth.users
-- Ejecuta esto primero y copia el ID que aparece
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'hessen@test.io';

-- PASO 2: Reemplaza 'USER_ID_AQUI' con el ID que obtuviste arriba
-- Luego ejecuta todo el bloque siguiente:

-- Confirmar email
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'hessen@test.io';

-- Crear sucursal si no existe
INSERT INTO public.branches (id, name, address, city, region, phone, email, is_active, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Sucursal Principal',
  'Av. Principal 123',
  'Santiago',
  'Metropolitana',
  '+56 2 1234 5678',
  'contacto@skalemotors.cl',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Deshabilitar RLS temporalmente para insertar
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Insertar o actualizar usuario (REEMPLAZA 'USER_ID_AQUI' con el ID real)
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

-- Rehabilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Asegurar políticas RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Verificar que se creó correctamente
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.onboarding_completed,
  b.name as branch_name
FROM public.users u
LEFT JOIN public.branches b ON u.branch_id = b.id
WHERE u.email = 'hessen@test.io';


