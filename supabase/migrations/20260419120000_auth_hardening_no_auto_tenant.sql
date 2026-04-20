-- ============================================================================
-- SECURITY HARDENING: Bloquear creación automática de tenants en signup
-- ============================================================================
-- Antes: cualquier signup (email/password) activaba el trigger
--        handle_new_user_signup, el cual creaba un tenant nuevo + admin si no
--        había un pending_vendor_provisions match.
-- Ahora: solo se crea fila en public.users si existe un pending_vendor_provisions
--        (alta por Edge Function) o si el email tiene una invitación explícita
--        (futuro). Signups no autorizados quedan sin perfil y el cliente los
--        rechaza con NO_PROFILE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email      TEXT;
  v_full_name  TEXT;
  v_pending    RECORD;
BEGIN
  v_email := LOWER(TRIM(NEW.email));

  -- Legacy protegido: no re-procesar
  IF v_email = 'hessen@test.io' THEN
    RETURN NEW;
  END IF;

  -- Usuario ya tiene perfil con tenant: nada que hacer
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = NEW.id AND tenant_id IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    SPLIT_PART(v_email, '@', 1)
  );

  -- Flujo de alta de vendedor: única fuente válida para nuevas cuentas
  SELECT * INTO v_pending
  FROM public.pending_vendor_provisions
  WHERE lower(trim(email)) = v_email
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_pending.branch_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = v_pending.branch_id
        AND b.tenant_id = v_pending.tenant_id
    ) THEN
      DELETE FROM public.pending_vendor_provisions WHERE id = v_pending.id;
      RAISE EXCEPTION 'pending_vendor_provisions: branch does not belong to tenant';
    END IF;

    DELETE FROM public.pending_vendor_provisions WHERE id = v_pending.id;

    INSERT INTO public.users (
      id, email, full_name, phone,
      role, tenant_id, branch_id,
      is_active, legacy_protected, onboarding_completed
    )
    VALUES (
      NEW.id, NEW.email, v_full_name,
      NEW.raw_user_meta_data->>'phone',
      v_pending.role,
      v_pending.tenant_id,
      v_pending.branch_id,
      true, false, true
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      tenant_id = EXCLUDED.tenant_id,
      branch_id = EXCLUDED.branch_id,
      is_active = true,
      onboarding_completed = true,
      updated_at = NOW();

    RETURN NEW;
  END IF;

  -- Sin pending_vendor_provisions: NO crear tenant + admin automáticamente.
  -- La fila en auth.users queda huérfana (sin public.users) y el cliente
  -- rechaza el login con NO_PROFILE. Un admin puede limpiar estos huérfanos
  -- ejecutando DELETE en auth.users desde dashboard si hace falta.
  RETURN NEW;
END;
$$;

-- ============================================================================
-- RLS: Policy restrictiva sobre public.users para bloquear lecturas sin tenant
-- Defensa en profundidad: aunque el cliente ya lo maneja, el DB tampoco revela
-- nada a un JWT sin tenant_id resuelto.
-- ============================================================================

DROP POLICY IF EXISTS users_restrict_no_tenant ON public.users;
CREATE POLICY users_restrict_no_tenant ON public.users
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    -- Permitir si el caller es legacy protegido (hessen@test.io)
    public.current_is_legacy_protected()
    -- O si el caller está leyendo SU PROPIA fila (necesario para fetchUserProfile)
    OR id = auth.uid()
    -- O si el caller tiene tenant resuelto y la fila pertenece a ese tenant
    OR (public.current_tenant_id() IS NOT NULL AND tenant_id = public.current_tenant_id())
  );

-- ============================================================================
-- Constraint: evitar filas huérfanas en public.users (tenant_id NULL) salvo legacy
-- NOT VALID para no romper datos existentes; nuevas filas deben cumplir.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_tenant_id_required_except_legacy'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_tenant_id_required_except_legacy
      CHECK (
        tenant_id IS NOT NULL
        OR legacy_protected = true
        OR email = 'hessen@test.io'
      ) NOT VALID;
  END IF;
END $$;

COMMENT ON FUNCTION public.handle_new_user_signup() IS
  'SECURITY: no auto-crea tenant/admin. Solo procesa signups que vienen por pending_vendor_provisions (alta controlada por Edge Function).';
