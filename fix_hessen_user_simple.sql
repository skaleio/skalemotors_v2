-- =====================================================
-- SCRIPT SIMPLE PARA CREAR/ACTUALIZAR USUARIO hessen@test.io
-- SKALEMOTORS - Versión simplificada
-- =====================================================

-- 1. Confirmar email en auth.users
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'hessen@test.io';

-- 2. Obtener el ID del usuario de auth.users
DO $$
DECLARE
  user_id_val UUID;
BEGIN
  -- Obtener el ID del usuario
  SELECT id INTO user_id_val
  FROM auth.users
  WHERE email = 'hessen@test.io'
  LIMIT 1;

  IF user_id_val IS NULL THEN
    RAISE EXCEPTION 'Usuario hessen@test.io no encontrado en auth.users. Por favor, créalo primero en Supabase Dashboard > Authentication > Users';
  END IF;

  RAISE NOTICE 'Usuario encontrado en auth.users con ID: %', user_id_val;

  -- 3. Asegurar que existe una sucursal por defecto
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

  -- 4. Insertar o actualizar el usuario en public.users
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
  VALUES (
    user_id_val,
    'hessen@test.io',
    'Hessen',
    'admin',
    '550e8400-e29b-41d4-a716-446655440000',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    role = COALESCE(EXCLUDED.role, public.users.role),
    branch_id = COALESCE(EXCLUDED.branch_id, public.users.branch_id),
    is_active = true,
    onboarding_completed = COALESCE(EXCLUDED.onboarding_completed, public.users.onboarding_completed),
    updated_at = NOW();

  RAISE NOTICE 'Usuario creado/actualizado en public.users con ID: %', user_id_val;
END $$;

-- 5. Verificar el resultado
SELECT 
  'Verificación del usuario:' as info,
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.onboarding_completed,
  u.branch_id,
  b.name as branch_name,
  CASE 
    WHEN au.email_confirmed_at IS NOT NULL THEN 'Confirmado'
    ELSE 'No confirmado'
  END as email_status
FROM public.users u
LEFT JOIN public.branches b ON u.branch_id = b.id
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'hessen@test.io';

-- 6. Asegurar políticas RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id);

-- 7. Mensaje final
SELECT '✅ Usuario hessen@test.io configurado correctamente. Ahora debería poder iniciar sesión.' as status;

