-- Vitrina pública multi-tenant + Web Builder (Enfoque A)
-- Spec: docs/superpowers/specs/2026-05-28-vitrina-publica-web-builder-design.md
--
-- Crea:
--   - public.tenant_sites    (config del sitio público, 1 fila por tenant)
--   - public.tenant_domains  (dominios/subdominios -> tenant)
--   - vehicles.publicado_web (flag de publicación en la vitrina)
-- Aislamiento multi-tenant: tenant_id NOT NULL + RLS (restrictiva + permisivas) + autofill.
-- La lectura pública NO usa anon; se hace vía Edge Function con service_role.

-- =====================================================================
-- 1. tenant_sites
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tenant_sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_published    boolean NOT NULL DEFAULT false,
  theme           text NOT NULL DEFAULT 'moderna'
                    CHECK (theme IN ('moderna', 'tradicional', 'premium')),
  site_name       text,
  logo_url        text,
  primary_color   text NOT NULL DEFAULT '#7c3aed',
  secondary_color text,
  hero_title      text,
  hero_subtitle   text,
  hero_image_url  text,
  about_text      text,
  whatsapp_phone  text,
  contact_email   text,
  contact_phone   text,
  address         text,
  social          jsonb NOT NULL DEFAULT '{}'::jsonb,
  sections        jsonb NOT NULL DEFAULT
                    '{"features":true,"vehicles":true,"videos":false,"contact":true,"marketing":false}'::jsonb,
  videos          jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title       text,
  seo_description text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_sites_tenant_unique UNIQUE (tenant_id)
);

ALTER TABLE public.tenant_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_restrict_tenant_sites ON public.tenant_sites
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY tenant_sites_select_auth ON public.tenant_sites
  FOR SELECT TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY tenant_sites_insert_auth ON public.tenant_sites
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY tenant_sites_update_auth ON public.tenant_sites
  FOR UPDATE TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY tenant_sites_delete_auth ON public.tenant_sites
  FOR DELETE TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE TRIGGER trg_tenant_sites_autofill_tenant
  BEFORE INSERT ON public.tenant_sites
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE TRIGGER trg_tenant_sites_updated_at
  BEFORE UPDATE ON public.tenant_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 2. tenant_domains
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain              text NOT NULL,
  kind                text NOT NULL CHECK (kind IN ('subdomain', 'custom')),
  is_primary          boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending', 'verified', 'error')),
  vercel_domain_id    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_domains_domain_unique UNIQUE (domain),
  CONSTRAINT tenant_domains_domain_lowercase CHECK (domain = lower(domain))
);

-- A lo sumo un dominio primario por tenant
CREATE UNIQUE INDEX IF NOT EXISTS tenant_domains_one_primary
  ON public.tenant_domains (tenant_id) WHERE is_primary;

CREATE INDEX IF NOT EXISTS tenant_domains_tenant_idx
  ON public.tenant_domains (tenant_id);

ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_restrict_tenant_domains ON public.tenant_domains
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY tenant_domains_select_auth ON public.tenant_domains
  FOR SELECT TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY tenant_domains_insert_auth ON public.tenant_domains
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY tenant_domains_update_auth ON public.tenant_domains
  FOR UPDATE TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE POLICY tenant_domains_delete_auth ON public.tenant_domains
  FOR DELETE TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE TRIGGER trg_tenant_domains_autofill_tenant
  BEFORE INSERT ON public.tenant_domains
  FOR EACH ROW EXECUTE FUNCTION public.autofill_tenant_branch_from_user();

CREATE TRIGGER trg_tenant_domains_updated_at
  BEFORE UPDATE ON public.tenant_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 3. vehicles.publicado_web
-- =====================================================================
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS publicado_web boolean NOT NULL DEFAULT false;

-- Indice para el filtro de la vitrina (autos publicados por tenant)
CREATE INDEX IF NOT EXISTS vehicles_publicado_web_idx
  ON public.vehicles (tenant_id) WHERE publicado_web;

COMMENT ON COLUMN public.vehicles.publicado_web IS
  'Si true, el vehiculo aparece en la vitrina publica del tenant (independiente de marketplaces).';
