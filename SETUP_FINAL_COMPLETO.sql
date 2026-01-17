-- =====================================================
-- CONFIGURACIÓN COMPLETA Y DEFINITIVA - SKALEMOTORS
-- Ejecutar TODO este script UNA SOLA VEZ
-- =====================================================

-- 1. Asegurar que las extensiones existen
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Crear/Verificar tabla branches
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT, 
    email TEXT,
    city TEXT NOT NULL,
    region TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear/Verificar tabla users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'gerente', 'vendedor', 'financiero', 'servicio', 'inventario')),
    branch_id UUID REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear sucursal principal
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

-- 5. Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 6. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.users';
    END LOOP;
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branches') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.branches';
    END LOOP;
END $$;

-- 7. CREAR POLÍTICAS CORRECTAS PARA USUARIOS

-- INSERCIÓN: Permitir que nuevos usuarios creen su perfil
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- LECTURA: Usuarios pueden ver su propio perfil
CREATE POLICY "users_select_own" ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

-- ACTUALIZACIÓN: Usuarios pueden actualizar su propio perfil
CREATE POLICY "users_update_own" ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- LECTURA ADMIN: Admins pueden ver todos los usuarios
CREATE POLICY "users_select_admin" ON public.users 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 8. POLÍTICAS PARA BRANCHES
CREATE POLICY "branches_select_all" ON public.branches 
  FOR SELECT 
  USING (true);

CREATE POLICY "branches_all_admin" ON public.branches 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 9. FUNCIÓN Y TRIGGER PARA AUTO-CREAR USUARIOS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    full_name, 
    role, 
    is_active, 
    branch_id, 
    onboarding_completed
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor'),
    true,
    '550e8400-e29b-41d4-a716-446655440000',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Eliminar trigger si existe y recrearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 10. ARREGLAR USUARIO EXISTENTE (17antoniomro@gmail.com)
INSERT INTO public.users (id, email, full_name, role, branch_id, is_active, onboarding_completed)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'Antonio Rodriguez'),
  'admin',
  '550e8400-e29b-41d4-a716-446655440000',
  true,
  true
FROM auth.users au
WHERE au.email = '17antoniomro@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
  role = EXCLUDED.role,
  branch_id = EXCLUDED.branch_id,
  is_active = true,
  onboarding_completed = true;

-- 11. CONFIRMAR EMAILS DE USUARIOS EXISTENTES
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- 12. VERIFICACIÓN FINAL
SELECT 
  '✅ CONFIGURACIÓN COMPLETA' as status,
  (SELECT COUNT(*) FROM public.users) as total_usuarios,
  (SELECT COUNT(*) FROM public.branches) as total_sucursales,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') as politicas_users;

-- 13. MOSTRAR USUARIOS
SELECT 
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.onboarding_completed,
  CASE WHEN au.email_confirmed_at IS NOT NULL THEN '✅' ELSE '❌' END as email_ok
FROM public.users u
LEFT JOIN auth.users au ON u.id = au.id
ORDER BY u.created_at DESC;

