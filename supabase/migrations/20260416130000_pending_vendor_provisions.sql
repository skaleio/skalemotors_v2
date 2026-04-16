-- ============================================================================
-- Provisionamiento seguro de cuentas vendedor en un tenant existente.
-- La Edge Function inserta aquí ANTES de auth.admin.createUser; el trigger
-- handle_new_user_signup consume la fila y crea public.users sin nuevo tenant.
-- Así un usuario no puede auto-registrarse en otro tenant vía user_metadata.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pending_vendor_provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'vendedor'
    CHECK (role IN ('vendedor')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_vendor_provisions_email_lower
  ON public.pending_vendor_provisions (lower(trim(email)));

CREATE INDEX IF NOT EXISTS idx_pending_vendor_provisions_expires
  ON public.pending_vendor_provisions (expires_at);

ALTER TABLE public.pending_vendor_provisions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pending_vendor_provisions IS
  'Cola segura para alta de vendedores: solo service role escribe; el trigger de auth lee al crear el usuario.';

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id  UUID;
  v_branch_id  UUID;
  v_email      TEXT;
  v_full_name  TEXT;
  v_slug       TEXT;
  v_company    TEXT;
  v_pending    RECORD;
BEGIN
  v_email := LOWER(TRIM(NEW.email));

  IF v_email = 'hessen@test.io' THEN
    RETURN NEW;
  END IF;

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

  v_company := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    v_full_name || ' Automotora'
  );

  v_slug := REGEXP_REPLACE(
    LOWER(SPLIT_PART(v_email, '@', 1)) || '-' ||
    SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6),
    '[^a-z0-9-]', '-', 'g'
  );

  INSERT INTO public.tenants (slug, name, status, legacy_mode)
  VALUES (v_slug, v_company, 'active', false)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.branches (name, address, city, region, is_active, tenant_id)
  VALUES ('Sucursal Principal', 'Por completar', 'Por completar', 'Por completar', true, v_tenant_id)
  RETURNING id INTO v_branch_id;

  INSERT INTO public.users (
    id, email, full_name, phone,
    role, tenant_id, branch_id,
    is_active, legacy_protected, onboarding_completed
  )
  VALUES (
    NEW.id, NEW.email, v_full_name,
    NEW.raw_user_meta_data->>'phone',
    'admin', v_tenant_id, v_branch_id,
    true, false, false
  )
  ON CONFLICT (id) DO UPDATE
  SET
    tenant_id   = EXCLUDED.tenant_id,
    branch_id   = EXCLUDED.branch_id,
    role        = 'admin',
    is_active   = true,
    updated_at  = NOW()
  WHERE public.users.tenant_id IS NULL;

  INSERT INTO public.tenant_feature_flags (tenant_id, flag_key, enabled)
  VALUES
    (v_tenant_id, 'tenant_rbac',             true),
    (v_tenant_id, 'automated_provisioning',  true),
    (v_tenant_id, 'strict_finance_access',   true),
    (v_tenant_id, 'investor_ready_security', false)
  ON CONFLICT (tenant_id, flag_key) DO NOTHING;

  INSERT INTO public.tenant_billing (tenant_id, billing_mode, trial_ends_at)
  VALUES (v_tenant_id, 'manual', NOW() + INTERVAL '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;
