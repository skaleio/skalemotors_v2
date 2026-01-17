-- =====================================================
-- CREAR USUARIOS DE PRUEBA URGENTE
-- Ejecuta esto en Supabase SQL Editor
-- =====================================================

-- 1. Primero, asegurar que el esquema base existe
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

-- 2. Crear sucursal de prueba
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

-- 3. Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 5. Crear función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor'),
    true,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Crear trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. AHORA CREAR USUARIO MANUALMENTE EN AUTH.USERS
-- NOTA: Esto normalmente se hace a través del registro, pero lo haremos manual

-- Insertar en auth.users (password hasheado para '123456789')
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  role,
  aud
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  '00000000-0000-0000-0000-000000000000',
  'admin@skalemotors.cl',
  crypt('123456789', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"full_name": "Administrador", "role": "admin"}',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- 8. Insertar en public.users (esto debería hacerse automáticamente con el trigger)
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  branch_id,
  is_active,
  onboarding_completed
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'admin@skalemotors.cl',
  'Administrador',
  'admin',
  '550e8400-e29b-41d4-a716-446655440000',
  true,
  true
) ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  onboarding_completed = EXCLUDED.onboarding_completed;

-- 9. Verificar que todo se creó correctamente
SELECT 'VERIFICACIÓN DE USUARIOS:' as status;
SELECT id, email, encrypted_password IS NOT NULL as has_password FROM auth.users WHERE email = 'admin@skalemotors.cl';
SELECT id, email, full_name, role FROM public.users WHERE email = 'admin@skalemotors.cl';
