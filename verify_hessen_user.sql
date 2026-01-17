-- =====================================================
-- SCRIPT PARA VERIFICAR EL USUARIO hessen@test.io
-- SKALEMOTORS
-- =====================================================

-- 1. Verificar que el usuario existe en auth.users
SELECT 
  'auth.users' as tabla,
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
FROM auth.users
WHERE email = 'hessen@test.io';

-- 2. Verificar que el usuario existe en public.users
SELECT 
  'public.users' as tabla,
  id,
  email,
  full_name,
  role,
  branch_id,
  is_active,
  onboarding_completed,
  created_at,
  updated_at
FROM public.users
WHERE email = 'hessen@test.io';

-- 3. Verificar las políticas RLS en public.users
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY policyname;

-- 4. Verificar que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'users';

-- 5. Probar si el usuario puede ver su propio perfil (simulando con el ID)
-- NOTA: Esto requiere ejecutarse con el contexto del usuario autenticado
-- Por eso solo mostramos la consulta que debería funcionar
SELECT 
  'Test query (ejecutar con sesión del usuario):' as nota,
  'SELECT * FROM public.users WHERE id = auth.uid();' as query;

