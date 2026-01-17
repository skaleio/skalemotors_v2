-- =====================================================
-- SCRIPT PARA LIMPIAR USUARIOS DE PRUEBA
-- SKALEMOTORS - Ejecutar con cuidado
-- =====================================================

-- 1. Eliminar usuarios de prueba de public.users
DELETE FROM public.users 
WHERE email IN ('hessen@test.io', '17antoniomro@gmail.com', 'test@skale.io');

-- 2. Verificar usuarios restantes
SELECT id, email, full_name, role 
FROM public.users 
ORDER BY created_at DESC;

-- 3. Verificar usuarios en auth.users (solo lectura, no se pueden eliminar desde aquí)
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email IN ('hessen@test.io', '17antoniomro@gmail.com', 'test@skale.io')
ORDER BY created_at DESC;

-- NOTA: Para eliminar usuarios de auth.users, usa el Dashboard de Supabase:
-- Authentication > Users > Selecciona el usuario > Delete

