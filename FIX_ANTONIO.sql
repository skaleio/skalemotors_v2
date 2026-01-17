-- =====================================================
-- FIX PARA 17antoniomro@gmail.com
-- =====================================================

-- 1. Confirmar email
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = '17antoniomro@gmail.com';

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

-- 4. INSERTAR USUARIO (usando el ID que se ve en la captura: 6d335df9-d064-4ae1-8d9e-2e4534774c86)
INSERT INTO public.users (id, email, full_name, role, branch_id, is_active, onboarding_completed)
VALUES (
  '6d335df9-d064-4ae1-8d9e-2e4534774c86',
  '17antoniomro@gmail.com',
  'Antonio Rodriguez',
  'admin',
  '550e8400-e29b-41d4-a716-446655440000',
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  is_active = true,
  onboarding_completed = true;

-- 5. REHABILITAR RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. CREAR POLÍTICAS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users 
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users 
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 7. VERIFICAR
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.onboarding_completed
FROM public.users u
WHERE u.email = '17antoniomro@gmail.com';

