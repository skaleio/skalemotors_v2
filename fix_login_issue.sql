-- =====================================================
-- SCRIPT PARA SOLUCIONAR EL PROBLEMA DE LOGIN
-- SKALEMOTORS - Aplicar esquema corregido
-- =====================================================

-- 1. Crear la función para manejar nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor'),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el trigger para ejecutar la función cuando se crea un usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Asegurar que las políticas RLS permitan a los usuarios ver su propio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- 4. Permitir que los usuarios actualicen su propio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 5. Permitir que los administradores vean todos los usuarios
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 6. Crear usuarios de prueba si no existen
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

-- 7. Verificar que RLS esté habilitado en la tabla users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 8. Comentarios de verificación
SELECT 'Trigger y políticas aplicados correctamente' as status;
