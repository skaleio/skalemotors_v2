-- Script para crear usuario de prueba
-- Ejecutar en Supabase SQL Editor

-- Crear sucursal de prueba
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

-- Crear usuario de prueba (esto se hará automáticamente cuando se registre)
-- Pero podemos crear uno manualmente para pruebas
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  branch_id,
  is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'admin@skalemotors.cl',
  'Administrador',
  'admin',
  '550e8400-e29b-41d4-a716-446655440000',
  true
) ON CONFLICT (id) DO NOTHING;

-- También crear un vendedor de prueba
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  branch_id,
  is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'vendedor@skalemotors.cl',
  'Vendedor Prueba',
  'vendedor',
  '550e8400-e29b-41d4-a716-446655440000',
  true
) ON CONFLICT (id) DO NOTHING;
