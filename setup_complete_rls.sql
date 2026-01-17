-- =====================================================
-- CONFIGURACIÓN COMPLETA DE RLS Y POLÍTICAS
-- SKALEMOTORS - Ejecutar TODO este script
-- =====================================================

-- 1. Asegurar que las tablas existen con todos los campos
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

-- 2. Crear sucursal principal si no existe
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

-- 3. Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 4. ELIMINAR TODAS LAS POLÍTICAS EXISTENTES
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;

-- 5. CREAR POLÍTICAS CORRECTAS PARA USUARIOS

-- Política para INSERT: Permitir que los usuarios inserten su propio perfil cuando se registran
-- Esto es CRÍTICO para que el registro funcione
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Política para SELECT: Usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile" ON public.users 
  FOR SELECT 
  USING (auth.uid() = id);

-- Política para UPDATE: Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.users 
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política para SELECT: Admins pueden ver todos los usuarios
CREATE POLICY "Admins can view all users" ON public.users 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. CREAR POLÍTICAS PARA BRANCHES

-- Todos pueden ver sucursales
CREATE POLICY "Users can view branches" ON public.branches 
  FOR SELECT 
  USING (true);

-- Admins pueden gestionar sucursales
CREATE POLICY "Admins can manage branches" ON public.branches 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. CREAR FUNCIÓN Y TRIGGER PARA NUEVOS USUARIOS (por si acaso)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active, branch_id, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor'),
    true,
    '550e8400-e29b-41d4-a716-446655440000', -- Sucursal Principal
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe y recrearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Verificar políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'branches')
ORDER BY tablename, policyname;

-- 9. Mensaje final
SELECT '✅ Configuración RLS completada. Ahora el registro y login deberían funcionar.' as status;

