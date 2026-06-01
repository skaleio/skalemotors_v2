-- Integración Zernio — redes sociales org + personal
-- Spec: docs/superpowers/specs/2026-05-30-zernio-redes-sociales-design.md

-- =====================================================================
-- 1. zernio_org_profiles (1 profile Zernio por tenant)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.zernio_org_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  zernio_profile_id text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zernio_org_profiles_tenant_unique UNIQUE (tenant_id),
  CONSTRAINT zernio_org_profiles_zernio_id_unique UNIQUE (zernio_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_zernio_org_profiles_tenant
  ON public.zernio_org_profiles (tenant_id);

-- =====================================================================
-- 2. zernio_user_profiles (1 profile Zernio por usuario)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.zernio_user_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zernio_profile_id text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zernio_user_profiles_user_unique UNIQUE (user_id),
  CONSTRAINT zernio_user_profiles_zernio_id_unique UNIQUE (zernio_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_zernio_user_profiles_tenant_user
  ON public.zernio_user_profiles (tenant_id, user_id);

-- =====================================================================
-- 3. zernio_accounts (cuentas OAuth conectadas)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.zernio_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope             text NOT NULL CHECK (scope IN ('org', 'personal')),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  zernio_account_id text NOT NULL,
  platform          text NOT NULL,
  display_name      text,
  username          text,
  avatar_url        text,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'disconnected', 'error')),
  last_error        text,
  connected_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zernio_accounts_scope_user_check CHECK (
    (scope = 'org' AND user_id IS NULL)
    OR (scope = 'personal' AND user_id IS NOT NULL)
  ),
  CONSTRAINT zernio_accounts_tenant_scope_account_unique
    UNIQUE (tenant_id, scope, zernio_account_id)
);

CREATE INDEX IF NOT EXISTS idx_zernio_accounts_tenant_scope
  ON public.zernio_accounts (tenant_id, scope);

CREATE INDEX IF NOT EXISTS idx_zernio_accounts_user
  ON public.zernio_accounts (user_id)
  WHERE user_id IS NOT NULL;

-- =====================================================================
-- 4. zernio_posts (auditoría local de publicaciones)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.zernio_posts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope          text NOT NULL CHECK (scope IN ('org', 'personal')),
  created_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zernio_post_id text,
  content        text NOT NULL,
  media_urls     jsonb NOT NULL DEFAULT '[]'::jsonb,
  platforms      jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_for  timestamptz,
  timezone       text NOT NULL DEFAULT 'America/Santiago',
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  last_error     text,
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zernio_posts_tenant_scope_created
  ON public.zernio_posts (tenant_id, scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_zernio_posts_created_by
  ON public.zernio_posts (created_by, created_at DESC);

-- =====================================================================
-- RLS helpers (roles org)
-- =====================================================================
-- Conectar org: admin, gerente, jefe_jefe
-- Publicar org: admin, gerente, jefe_jefe, jefe_sucursal

-- =====================================================================
-- zernio_org_profiles
-- =====================================================================
ALTER TABLE public.zernio_org_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_restrict_zernio_org_profiles ON public.zernio_org_profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY zernio_org_profiles_select ON public.zernio_org_profiles
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal')
    )
  );

CREATE POLICY zernio_org_profiles_mutate ON public.zernio_org_profiles
  FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
    )
  );

CREATE TRIGGER trg_zernio_org_profiles_autofill_tenant
  BEFORE INSERT ON public.zernio_org_profiles
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE TRIGGER trg_zernio_org_profiles_updated_at
  BEFORE UPDATE ON public.zernio_org_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- zernio_user_profiles
-- =====================================================================
ALTER TABLE public.zernio_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_restrict_zernio_user_profiles ON public.zernio_user_profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY zernio_user_profiles_select_own ON public.zernio_user_profiles
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id() AND user_id = auth.uid())
  );

CREATE POLICY zernio_user_profiles_mutate_own ON public.zernio_user_profiles
  FOR ALL TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id() AND user_id = auth.uid())
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (tenant_id = public.current_tenant_id() AND user_id = auth.uid())
  );

CREATE TRIGGER trg_zernio_user_profiles_autofill_tenant
  BEFORE INSERT ON public.zernio_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE TRIGGER trg_zernio_user_profiles_updated_at
  BEFORE UPDATE ON public.zernio_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- zernio_accounts
-- =====================================================================
ALTER TABLE public.zernio_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_restrict_zernio_accounts ON public.zernio_accounts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY zernio_accounts_select ON public.zernio_accounts
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        (scope = 'personal' AND user_id = auth.uid())
        OR (
          scope = 'org'
          AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal')
        )
      )
    )
  );

CREATE POLICY zernio_accounts_insert ON public.zernio_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        (scope = 'personal' AND user_id = auth.uid())
        OR (
          scope = 'org'
          AND user_id IS NULL
          AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
        )
      )
    )
  );

CREATE POLICY zernio_accounts_update ON public.zernio_accounts
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        (scope = 'personal' AND user_id = auth.uid())
        OR (
          scope = 'org'
          AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
        )
      )
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        (scope = 'personal' AND user_id = auth.uid())
        OR (
          scope = 'org'
          AND user_id IS NULL
          AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
        )
      )
    )
  );

CREATE POLICY zernio_accounts_delete ON public.zernio_accounts
  FOR DELETE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        (scope = 'personal' AND user_id = auth.uid())
        OR (
          scope = 'org'
          AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe')
        )
      )
    )
  );

CREATE TRIGGER trg_zernio_accounts_autofill_tenant
  BEFORE INSERT ON public.zernio_accounts
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE TRIGGER trg_zernio_accounts_updated_at
  BEFORE UPDATE ON public.zernio_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- zernio_posts
-- =====================================================================
ALTER TABLE public.zernio_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_restrict_zernio_posts ON public.zernio_posts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY zernio_posts_select ON public.zernio_posts
  FOR SELECT TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        (scope = 'personal' AND created_by = auth.uid())
        OR (
          scope = 'org'
          AND public.current_user_role() IN ('admin', 'gerente', 'jefe_jefe', 'jefe_sucursal')
        )
      )
    )
  );

CREATE POLICY zernio_posts_insert ON public.zernio_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND created_by = auth.uid()
    )
  );

CREATE POLICY zernio_posts_update_own ON public.zernio_posts
  FOR UPDATE TO authenticated
  USING (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.current_is_legacy_protected()
    OR (
      tenant_id = public.current_tenant_id()
      AND created_by = auth.uid()
    )
  );

CREATE TRIGGER trg_zernio_posts_autofill_tenant
  BEFORE INSERT ON public.zernio_posts
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE TRIGGER trg_zernio_posts_updated_at
  BEFORE UPDATE ON public.zernio_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
