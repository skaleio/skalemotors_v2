-- =====================================================
-- SCRIPT PARA SOLUCIONAR EL PROBLEMA DE LOGIN
-- Usuario: hessen@test.io
-- SKALEMOTORS
-- =====================================================

-- 1. Verificar y confirmar el email del usuario en auth.users
-- Nota: confirmed_at es una columna generada y se actualiza automáticamente
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'hessen@test.io';

-- 2. Obtener el ID del usuario de auth.users
DO $$
DECLARE
  user_id_val UUID;
  user_email_val TEXT;
  user_meta_data JSONB;
BEGIN
  -- Obtener datos del usuario
  SELECT id, email, raw_user_meta_data INTO user_id_val, user_email_val, user_meta_data
  FROM auth.users
  WHERE email = 'hessen@test.io'
  LIMIT 1;

  IF user_id_val IS NULL THEN
    RAISE EXCEPTION 'Usuario hessen@test.io no encontrado en auth.users. Por favor, créalo primero en Supabase Dashboard.';
  END IF;

  RAISE NOTICE 'Usuario encontrado en auth.users: %', user_id_val;

  -- 3. Asegurar que existe una sucursal por defecto
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

  -- 4. Verificar si el usuario existe en public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_id_val) THEN
    -- Crear el registro en public.users
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
    ) VALUES (
      user_id_val,
      user_email_val,
      COALESCE(user_meta_data->>'full_name', 'Hessen'),
      COALESCE(user_meta_data->>'role', 'admin'),
      '550e8400-e29b-41d4-a716-446655440000', -- Sucursal Principal
      true,
      true, -- Completar onboarding automáticamente
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Usuario creado en public.users';
  ELSE
    -- Actualizar el usuario existente para asegurar que tenga todos los campos necesarios
    UPDATE public.users
    SET 
      email = user_email_val,
      full_name = COALESCE(full_name, COALESCE(user_meta_data->>'full_name', 'Hessen')),
      role = COALESCE(role, COALESCE(user_meta_data->>'role', 'admin')),
      branch_id = COALESCE(branch_id, '550e8400-e29b-41d4-a716-446655440000'),
      is_active = true,
      onboarding_completed = COALESCE(onboarding_completed, true),
      updated_at = NOW()
    WHERE id = user_id_val;
    RAISE NOTICE 'Usuario actualizado en public.users';
  END IF;

END $$;

-- 5. Verificar el resultado
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.onboarding_completed,
  u.branch_id,
  b.name as branch_name,
  au.email_confirmed_at,
  au.confirmed_at
FROM public.users u
LEFT JOIN public.branches b ON u.branch_id = b.id
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'hessen@test.io';

-- 6. Asegurar que las políticas RLS permitan al usuario ver su propio perfil
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

