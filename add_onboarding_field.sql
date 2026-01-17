-- =====================================================
-- Script para agregar campo onboarding_completed
-- a la tabla users existente
-- =====================================================

-- Agregar el campo onboarding_completed a la tabla users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Actualizar usuarios existentes para que no necesiten onboarding
-- (solo si quieres que los usuarios existentes no pasen por el onboarding)
-- UPDATE public.users SET onboarding_completed = true WHERE onboarding_completed IS NULL;

-- Crear índice para mejorar performance en consultas de onboarding
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed 
ON public.users(onboarding_completed);

-- Comentario sobre el campo
COMMENT ON COLUMN public.users.onboarding_completed IS 'Indica si el usuario ha completado el proceso de onboarding inicial';

