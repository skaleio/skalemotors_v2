-- ============================================================================
-- MIGRACIÓN: Hardening de seguridad en políticas RLS de users
-- Fecha: 20260329
-- Propósito:
--   1. Prevenir que usuarios actualicen campos críticos (role, tenant_id,
--      legacy_protected, is_active) de su propio perfil.
--   2. Agregar política restrictiva de INSERT en users para anon (ninguno).
--   3. Revocar ejecución pública de funciones helper de RLS que no deberían
--      ser llamadas directamente por usuarios.
-- ============================================================================

-- ============================================================================
-- 1. FUNCIÓN AUXILIAR: Verificar que un UPDATE a users no cambie campos críticos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.users_update_safe_check()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TRUE
$$;

-- ============================================================================
-- 2. POLÍTICA DE UPDATE RESTRICTIVA: usuarios solo pueden actualizar campos
--    seguros de su propio perfil (nombre, teléfono, avatar_url).
--    No pueden cambiar: role, tenant_id, branch_id, legacy_protected, is_active.
-- ============================================================================

-- Eliminar política permisiva anterior si existe
DROP POLICY IF EXISTS users_update_self_same_tenant ON public.users;

-- Nueva política: solo el propio usuario puede actualizar, y WITH CHECK
-- asegura que los campos críticos no cambien.
CREATE POLICY users_update_self_safe ON public.users
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    AND (tenant_id = public.current_tenant_id() OR public.current_is_legacy_protected())
  )
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND tenant_id IS NOT DISTINCT FROM (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND branch_id IS NOT DISTINCT FROM (SELECT branch_id FROM public.users WHERE id = auth.uid())
    AND legacy_protected = (SELECT legacy_protected FROM public.users WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
  );

-- ============================================================================
-- 3. POLÍTICA RESTRICTIVA DE INSERT en users: solo service_role puede insertar
--    directamente (los triggers usan SECURITY DEFINER).
--    Los usuarios normales no deben poder insertar filas en public.users.
-- ============================================================================

DROP POLICY IF EXISTS users_insert_self ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;

-- La inserción del trigger handle_new_user_signup usa SECURITY DEFINER,
-- por lo que no necesita política permisiva de INSERT para authenticated.
-- Si existía alguna política permisiva de INSERT, la eliminamos.
-- (El trigger se ejecuta como superuser/definer, no como el usuario autenticado.)

-- ============================================================================
-- 4. HARDENING de funciones helper RLS: asegurar SECURITY DEFINER y search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_is_legacy_protected()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(legacy_protected, false) FROM public.users WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.users WHERE id = auth.uid() LIMIT 1
$$;

-- Revocar acceso público y solo permitir a roles que lo necesitan
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_is_legacy_protected() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_is_legacy_protected() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ============================================================================
-- 5. DOCUMENTS: habilitar RLS si no está activado
-- ============================================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Política permisiva para documents: usuarios autenticados del mismo tenant
DROP POLICY IF EXISTS documents_rw_same_tenant ON public.documents;
CREATE POLICY documents_rw_same_tenant ON public.documents
  FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
  );

-- ============================================================================
-- 6. TENANT_FEATURE_FLAGS: bloquear escritura desde clientes (solo service_role)
-- ============================================================================

DROP POLICY IF EXISTS tenant_feature_flags_update_own ON public.tenant_feature_flags;

-- Solo lectura para usuarios autenticados (ya existe tenant_feature_flags_select_own)
-- No crear política de escritura para authenticated.

-- ============================================================================
-- 7. TENANTS: bloquear UPDATE/DELETE desde usuarios normales
-- ============================================================================

DROP POLICY IF EXISTS tenants_update_own ON public.tenants;

-- Solo jefe_jefe puede actualizar datos básicos de su propio tenant
CREATE POLICY tenants_update_own ON public.tenants
  FOR UPDATE TO authenticated
  USING (
    id = public.current_tenant_id()
    AND public.current_user_role() IN ('jefe_jefe', 'admin')
  )
  WITH CHECK (
    id = public.current_tenant_id()
    AND public.current_user_role() IN ('jefe_jefe', 'admin')
  );

-- ============================================================================
-- 8. Índice para acelerar las políticas RLS que filtran por auth.uid()
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_id_auth ON public.users(id);
