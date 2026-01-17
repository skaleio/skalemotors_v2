-- =====================================================
-- FIX DEFINITIVO - EJECUTAR TODO ESTE SCRIPT
-- =====================================================

-- 1. Confirmar email del usuario
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = 'hessen@test.io';

-- 2. Crear sucursal
INSERT INTO public.branches (id, name, address, city, region, phone, email, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Sucursal Principal',
  'Av. Principal 123',
  'Santiago',
  'Metropolitana',
  '+56 2 1234 5678',
  'contacto@skalemotors.cl',
  true
) ON CONFLICT (id) DO NOTHING;

-- 3. DESHABILITAR RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 4. INSERTAR USUARIO
INSERT INTO public.users (id, email, full_name, role, branch_id, is_active, onboarding_completed)
SELECT 
  au.id,
  'hessen@test.io',
  'Hessen',
  'admin',
  '550e8400-e29b-41d4-a716-446655440000',
  true,
  true
FROM auth.users au
WHERE au.email = 'hessen@test.io'
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  is_active = true,
  onboarding_completed = true;

-- 5. REHABILITAR RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. CREAR POLÍTICAS RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users 
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users 
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 7. VERIFICAR
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.onboarding_completed,
  CASE WHEN au.email_confirmed_at IS NOT NULL THEN '✅ OK' ELSE '❌ NO' END as email_confirmado
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'hessen@test.io';

