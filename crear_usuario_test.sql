-- =====================================================
-- CREAR USUARIO DE PRUEBA: test@skale.io
-- SKALEMOTORS - Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Asegurar que las tablas existen
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
INSERT INTO public.branches (id, name, address, city, region, phone, email)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Sucursal Principal',
  'Av. Principal 123',
  'Santiago',
  'Metropolitana',
  '+56 2 1234 5678',
  'contacto@skalemotors.cl'
) ON CONFLICT (id) DO NOTHING;

-- 3. Crear el usuario en auth.users (esto se hace a través de la API de Supabase)
-- NOTA: Este paso debe hacerse a través de la interfaz de Supabase o la API
-- ya que no se puede insertar directamente en auth.users desde SQL

-- 4. Función para manejar nuevos usuarios (si no existe)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active, branch_id, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario Test'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
    true,
    '550e8400-e29b-41d4-a716-446655440000', -- Sucursal Principal
    true -- Completar onboarding automáticamente
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Crear trigger para nuevos usuarios (si no existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Habilitar RLS en las tablas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 7. Crear políticas RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Users can view branches" ON public.branches;
CREATE POLICY "Users can view branches" ON public.branches FOR SELECT USING (true);

-- 8. Verificar que el usuario test@skale.io existe
-- (Este query se ejecutará después de crear el usuario)
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
WHERE u.email = 'test@skale.io';



