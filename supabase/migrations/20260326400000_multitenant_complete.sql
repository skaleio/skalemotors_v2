-- ============================================================================
-- MIGRACIÓN: Multi-Tenancy Completo — SkaléMotors SaaS
-- Fecha: 20260326
-- Regla ABSOLUTA: no tocar ni eliminar datos de hessen@test.io
-- Estrategia: RLS restrictivo sobre policies permisivas existentes
-- ============================================================================

-- ============================================================================
-- PASO 1: Tablas base del tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'suspended', 'cancelled')),
  plan       TEXT NOT NULL DEFAULT 'starter'
               CHECK (plan IN ('starter', 'pro', 'enterprise')),
  legacy_mode            BOOLEAN NOT NULL DEFAULT false,
  protected_account_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_feature_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  flag_key   TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT false,
  payload    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, flag_key)
);

CREATE TABLE IF NOT EXISTS public.tenant_billing (
  tenant_id            UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_mode         TEXT NOT NULL DEFAULT 'manual'
                         CHECK (billing_mode IN ('manual', 'stripe_pending', 'stripe_active')),
  provider             TEXT,
  external_customer_id TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}'::JSONB,
  trial_ends_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tenants IS 'Un tenant = una automotora/empresa cliente del SaaS';
COMMENT ON TABLE public.tenant_feature_flags IS 'Feature flags por tenant';
COMMENT ON TABLE public.tenant_billing IS 'Estado de facturación; manual hasta integración de pagos';

-- ============================================================================
-- PASO 2: Crear el tenant legacy para hessen@test.io (cuenta protegida)
-- ============================================================================

DO $$
DECLARE
  v_legacy_tenant_id UUID;
BEGIN
  INSERT INTO public.tenants (slug, name, status, legacy_mode, protected_account_email)
  VALUES ('legacy-skale', 'SkaléMotors Legacy', 'active', true, 'hessen@test.io')
  ON CONFLICT (slug) DO UPDATE
    SET updated_at = NOW()
  RETURNING id INTO v_legacy_tenant_id;

  -- Feature flags para tenant legacy
  INSERT INTO public.tenant_feature_flags (tenant_id, flag_key, enabled)
  VALUES
    (v_legacy_tenant_id, 'tenant_rbac', true),
    (v_legacy_tenant_id, 'automated_provisioning', true),
    (v_legacy_tenant_id, 'strict_finance_access', false),
    (v_legacy_tenant_id, 'investor_ready_security', false)
  ON CONFLICT (tenant_id, flag_key) DO NOTHING;

  -- Billing stub para legacy
  INSERT INTO public.tenant_billing (tenant_id, billing_mode)
  VALUES (v_legacy_tenant_id, 'manual')
  ON CONFLICT (tenant_id) DO NOTHING;
END $$;

-- ============================================================================
-- PASO 3: Agregar columnas tenant_id y legacy_protected a users
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tenant_id        UUID REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS legacy_protected BOOLEAN NOT NULL DEFAULT false;

-- Asignar el tenant legacy a todos los usuarios existentes (incluyendo hessen@test.io)
DO $$
DECLARE
  v_legacy_tenant_id UUID;
BEGIN
  SELECT id INTO v_legacy_tenant_id FROM public.tenants WHERE slug = 'legacy-skale';

  -- Asignar tenant legacy a usuarios sin tenant
  UPDATE public.users
  SET tenant_id = v_legacy_tenant_id
  WHERE tenant_id IS NULL;

  -- Marcar hessen@test.io como legacy_protected
  UPDATE public.users
  SET legacy_protected = true
  WHERE lower(email) = 'hessen@test.io';
END $$;

-- Agregar columna tenant_id a branches
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Backfill branches con tenant del usuario que la tiene asignada
DO $$
DECLARE
  v_legacy_tenant_id UUID;
BEGIN
  SELECT id INTO v_legacy_tenant_id FROM public.tenants WHERE slug = 'legacy-skale';

  -- Desde branch_id de usuarios
  UPDATE public.branches b
  SET tenant_id = u.tenant_id
  FROM public.users u
  WHERE u.branch_id = b.id
    AND b.tenant_id IS NULL
    AND u.tenant_id IS NOT NULL;

  -- Resto → legacy
  UPDATE public.branches
  SET tenant_id = v_legacy_tenant_id
  WHERE tenant_id IS NULL;
END $$;

-- ============================================================================
-- PASO 4: Agregar tenant_id a tablas principales y backfill
-- ============================================================================

-- vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.vehicles v
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE v.branch_id = b.id AND v.tenant_id IS NULL;

-- sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.sales s
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE s.branch_id = b.id AND s.tenant_id IS NULL;

-- leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.leads l
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE l.branch_id = b.id AND l.tenant_id IS NULL;

-- appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.appointments a
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE a.branch_id = b.id AND a.tenant_id IS NULL;

-- consignaciones
ALTER TABLE public.consignaciones ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.consignaciones c
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE c.branch_id = b.id AND c.tenant_id IS NULL;

-- gastos_empresa
ALTER TABLE public.gastos_empresa ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.gastos_empresa g
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE g.branch_id = b.id AND g.tenant_id IS NULL;

-- ingresos_empresa
ALTER TABLE public.ingresos_empresa ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.ingresos_empresa i
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE i.branch_id = b.id AND i.tenant_id IS NULL;

-- messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.messages m
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE m.branch_id = b.id AND m.tenant_id IS NULL;

-- salary_distribution
ALTER TABLE public.salary_distribution ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.salary_distribution sd
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE sd.branch_id = b.id AND sd.tenant_id IS NULL;

-- vehicle_appraisals
ALTER TABLE public.vehicle_appraisals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.vehicle_appraisals va
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE va.branch_id = b.id AND va.tenant_id IS NULL;

-- pending_tasks
ALTER TABLE public.pending_tasks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.pending_tasks pt
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE pt.branch_id = b.id AND pt.tenant_id IS NULL;

-- documents (ya existe con branch_id, agregar tenant_id)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.documents d
SET tenant_id = b.tenant_id
FROM public.branches b
WHERE d.branch_id = b.id AND d.tenant_id IS NULL;

-- sale_expenses: no tiene branch_id, usar sale_id → sales → tenant_id
ALTER TABLE public.sale_expenses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
UPDATE public.sale_expenses se
SET tenant_id = s.tenant_id
FROM public.sales s
WHERE se.sale_id = s.id AND se.tenant_id IS NULL;

-- ============================================================================
-- PASO 5: Funciones helper para RLS
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

-- ============================================================================
-- PASO 6: RLS restrictivo por tenant (AS RESTRICTIVE se combina con AND con permisivas)
-- hessen@test.io tiene legacy_protected=true → siempre pasa la política restrictiva
-- ============================================================================

-- USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_users ON public.users;
CREATE POLICY tenant_restrict_users ON public.users
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );

-- BRANCHES: los tenants solo ven sus propias sucursales
DROP POLICY IF EXISTS tenant_restrict_branches ON public.branches;
CREATE POLICY tenant_restrict_branches ON public.branches
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR tenant_id = public.current_tenant_id()
  );

-- VEHICLES
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_vehicles ON public.vehicles;
CREATE POLICY tenant_restrict_vehicles ON public.vehicles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- SALES
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_sales ON public.sales;
CREATE POLICY tenant_restrict_sales ON public.sales
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- LEADS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_leads ON public.leads;
CREATE POLICY tenant_restrict_leads ON public.leads
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- APPOINTMENTS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_appointments ON public.appointments;
CREATE POLICY tenant_restrict_appointments ON public.appointments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- CONSIGNACIONES
ALTER TABLE public.consignaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_consignaciones ON public.consignaciones;
CREATE POLICY tenant_restrict_consignaciones ON public.consignaciones
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND (
      branch_id IS NULL
      OR branch_id IN (SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id())
    ))
  );

-- GASTOS_EMPRESA
ALTER TABLE public.gastos_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_gastos ON public.gastos_empresa;
CREATE POLICY tenant_restrict_gastos ON public.gastos_empresa
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- INGRESOS_EMPRESA
ALTER TABLE public.ingresos_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_ingresos ON public.ingresos_empresa;
CREATE POLICY tenant_restrict_ingresos ON public.ingresos_empresa
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_messages ON public.messages;
CREATE POLICY tenant_restrict_messages ON public.messages
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- SALARY_DISTRIBUTION
ALTER TABLE public.salary_distribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_salary ON public.salary_distribution;
CREATE POLICY tenant_restrict_salary ON public.salary_distribution
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- VEHICLE_APPRAISALS
ALTER TABLE public.vehicle_appraisals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_appraisals ON public.vehicle_appraisals;
CREATE POLICY tenant_restrict_appraisals ON public.vehicle_appraisals
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- PENDING_TASKS
ALTER TABLE public.pending_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_pending_tasks ON public.pending_tasks;
CREATE POLICY tenant_restrict_pending_tasks ON public.pending_tasks
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- DOCUMENTS
DROP POLICY IF EXISTS tenant_restrict_documents ON public.documents;
CREATE POLICY tenant_restrict_documents ON public.documents
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND branch_id IN (
      SELECT id FROM public.branches WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- SALE_EXPENSES (sin branch_id; aislar via sale → tenant)
ALTER TABLE public.sale_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_sale_expenses ON public.sale_expenses;
CREATE POLICY tenant_restrict_sale_expenses ON public.sale_expenses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id())
    OR (tenant_id IS NULL AND sale_id IN (
      SELECT id FROM public.sales WHERE tenant_id = public.current_tenant_id()
    ))
  );

-- TENANT_FEATURE_FLAGS: solo ver los propios
ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_feature_flags_select_own ON public.tenant_feature_flags;
CREATE POLICY tenant_feature_flags_select_own ON public.tenant_feature_flags
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- TENANT_BILLING: solo admin/financiero del tenant ve su billing
ALTER TABLE public.tenant_billing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_billing_select_own ON public.tenant_billing;
CREATE POLICY tenant_billing_select_own ON public.tenant_billing
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('admin', 'financiero', 'jefe_jefe')
  );

-- TENANTS: usuarios ven solo su tenant
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select_own ON public.tenants;
CREATE POLICY tenants_select_own ON public.tenants
  FOR SELECT TO authenticated
  USING (
    id = public.current_tenant_id()
    OR public.current_is_legacy_protected()
  );

-- ============================================================================
-- PASO 7: Trigger de auto-provisioning en signup
-- Se ejecuta automáticamente cuando un usuario se registra
-- NO procesa hessen@test.io (ya está protegido como legacy)
-- ============================================================================

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
BEGIN
  v_email := LOWER(TRIM(NEW.email));

  -- PROTECCIÓN: no re-procesar la cuenta legacy
  IF v_email = 'hessen@test.io' THEN
    RETURN NEW;
  END IF;

  -- Si el usuario ya existe en public.users con tenant asignado, no hacer nada
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

  v_company := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    v_full_name || ' Automotora'
  );

  -- Slug único: email-prefix + sufijo aleatorio 6 chars
  v_slug := REGEXP_REPLACE(
    LOWER(SPLIT_PART(v_email, '@', 1)) || '-' ||
    SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6),
    '[^a-z0-9-]', '-', 'g'
  );

  -- Crear tenant
  INSERT INTO public.tenants (slug, name, status, legacy_mode)
  VALUES (v_slug, v_company, 'active', false)
  RETURNING id INTO v_tenant_id;

  -- Crear sucursal principal
  INSERT INTO public.branches (name, address, city, region, is_active, tenant_id)
  VALUES ('Sucursal Principal', 'Por completar', 'Por completar', 'Por completar', true, v_tenant_id)
  RETURNING id INTO v_branch_id;

  -- Crear/actualizar perfil en public.users
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

  -- Feature flags base
  INSERT INTO public.tenant_feature_flags (tenant_id, flag_key, enabled)
  VALUES
    (v_tenant_id, 'tenant_rbac',             true),
    (v_tenant_id, 'automated_provisioning',  true),
    (v_tenant_id, 'strict_finance_access',   true),
    (v_tenant_id, 'investor_ready_security', false)
  ON CONFLICT (tenant_id, flag_key) DO NOTHING;

  -- Billing stub (trial 14 días)
  INSERT INTO public.tenant_billing (tenant_id, billing_mode, trial_ends_at)
  VALUES (v_tenant_id, 'manual', NOW() + INTERVAL '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Crear el trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- ============================================================================
-- PASO 8: RPC complete_tenant_onboarding (callable por usuarios autenticados)
-- Permite al usuario completar el onboarding con nombre de empresa, ciudad, etc.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_tenant_onboarding(
  p_company_name   TEXT,
  p_branch_city    TEXT    DEFAULT NULL,
  p_branch_address TEXT    DEFAULT NULL,
  p_branch_phone   TEXT    DEFAULT NULL,
  p_branch_region  TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_tenant_id UUID;
  v_branch_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

  SELECT tenant_id, branch_id
  INTO v_tenant_id, v_branch_id
  FROM public.users
  WHERE id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User has no tenant assigned. Contact support.';
  END IF;

  -- Actualizar nombre del tenant (empresa)
  UPDATE public.tenants
  SET name = TRIM(p_company_name), updated_at = NOW()
  WHERE id = v_tenant_id;

  -- Actualizar sucursal si se proporcionaron datos
  IF v_branch_id IS NOT NULL THEN
    UPDATE public.branches
    SET
      city    = COALESCE(NULLIF(TRIM(p_branch_city), ''),    city),
      address = COALESCE(NULLIF(TRIM(p_branch_address), ''), address),
      phone   = COALESCE(NULLIF(TRIM(p_branch_phone), ''),   phone),
      region  = COALESCE(NULLIF(TRIM(p_branch_region), ''),  region),
      updated_at = NOW()
    WHERE id = v_branch_id AND tenant_id = v_tenant_id;
  END IF;

  -- Marcar onboarding completado
  UPDATE public.users
  SET onboarding_completed = true, updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success',    true,
    'tenant_id',  v_tenant_id,
    'branch_id',  v_branch_id,
    'company',    p_company_name
  );
END;
$$;

-- Solo usuarios autenticados pueden llamar este RPC
REVOKE ALL ON FUNCTION public.complete_tenant_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_tenant_onboarding(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- PASO 9: provision_tenant idempotente (solo service_role, para admins de la plataforma)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.provision_tenant(
  p_slug                  TEXT,
  p_name                  TEXT,
  p_jefe_jefe_email       TEXT,
  p_jefe_jefe_full_name   TEXT,
  p_default_branch_name   TEXT DEFAULT 'Sucursal Principal'
)
RETURNS TABLE (tenant_id UUID, branch_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_branch_id UUID;
  v_jefe_id   UUID;
BEGIN
  INSERT INTO public.tenants (slug, name, status, legacy_mode)
  VALUES (p_slug, p_name, 'active', false)
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name, updated_at = NOW()
  RETURNING id INTO v_tenant_id;

  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    INSERT INTO public.branches (name, address, city, region, is_active, tenant_id)
    VALUES (p_default_branch_name, 'Pendiente', 'Pendiente', 'Pendiente', true, v_tenant_id)
    RETURNING id INTO v_branch_id;
  END IF;

  SELECT id INTO v_jefe_id
  FROM public.users
  WHERE LOWER(email) = LOWER(p_jefe_jefe_email)
  LIMIT 1;

  IF v_jefe_id IS NOT NULL THEN
    UPDATE public.users
    SET
      full_name  = COALESCE(NULLIF(TRIM(p_jefe_jefe_full_name), ''), full_name),
      tenant_id  = v_tenant_id,
      role       = 'admin',
      branch_id  = v_branch_id,
      is_active  = true,
      updated_at = NOW()
    WHERE id = v_jefe_id;
  END IF;

  INSERT INTO public.tenant_feature_flags (tenant_id, flag_key, enabled)
  VALUES
    (v_tenant_id, 'investor_ready_security', false),
    (v_tenant_id, 'tenant_rbac',             true),
    (v_tenant_id, 'automated_provisioning',  true),
    (v_tenant_id, 'strict_finance_access',   true)
  ON CONFLICT (tenant_id, flag_key) DO NOTHING;

  INSERT INTO public.tenant_billing (tenant_id, billing_mode)
  VALUES (v_tenant_id, 'manual')
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN QUERY SELECT v_tenant_id, v_branch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_tenant(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_tenant(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================================
-- PASO 10: Índices para performance en queries de tenant
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant_id         ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_tenant_id      ON public.branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id      ON public.vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_id         ON public.sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id         ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id  ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consignaciones_tenant   ON public.consignaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gastos_tenant_id        ON public.gastos_empresa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_tenant_id      ON public.ingresos_empresa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id      ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_salary_tenant_id        ON public.salary_distribution(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_tenant_id    ON public.vehicle_appraisals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_tasks_tenant    ON public.pending_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id     ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_expenses_tenant_id ON public.sale_expenses(tenant_id);
