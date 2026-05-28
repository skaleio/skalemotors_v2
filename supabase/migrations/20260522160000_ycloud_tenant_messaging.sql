-- YCloud multi-tenant: API key y webhook secret por tenant; provider ycloud en inboxes.
-- Incluye prerequisitos de whatsapp_saas (status en inboxes, columnas en messages) por si
-- 20260522143000_whatsapp_saas_inbox_credentials.sql aún no se aplicó en el proyecto.

-- ---------------------------------------------------------------------------
-- 0) Prerequisitos WhatsApp SaaS (idempotente)
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_inboxes
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS connected_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;

UPDATE public.whatsapp_inboxes
SET status = 'disconnected'
WHERE status IS NULL;

ALTER TABLE public.whatsapp_inboxes
  ALTER COLUMN status SET DEFAULT 'disconnected';

ALTER TABLE public.whatsapp_inboxes
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.whatsapp_inboxes
  DROP CONSTRAINT IF EXISTS whatsapp_inboxes_status_check;

ALTER TABLE public.whatsapp_inboxes
  ADD CONSTRAINT whatsapp_inboxes_status_check
  CHECK (status IN ('disconnected', 'pending', 'active', 'error'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_inboxes_active_branch
  ON public.whatsapp_inboxes (branch_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.whatsapp_inbox_credentials (
  inbox_id uuid PRIMARY KEY REFERENCES public.whatsapp_inboxes(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_inbox_credentials ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.whatsapp_inboxes_public
WITH (security_invoker = true)
AS
SELECT
  id,
  tenant_id,
  branch_id,
  provider,
  provider_phone_number_id,
  display_number,
  waba_id,
  status,
  last_error,
  connected_by,
  connected_at,
  is_active,
  created_at,
  updated_at
FROM public.whatsapp_inboxes;

GRANT SELECT ON public.whatsapp_inboxes_public TO authenticated;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id),
  ADD COLUMN IF NOT EXISTS inbox_id uuid REFERENCES public.whatsapp_inboxes(id),
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS provider_status_id text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- ---------------------------------------------------------------------------
-- 1) Configuración YCloud por tenant (secretos solo service_role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_ycloud_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key text NOT NULL,
  webhook_secret text,
  ycloud_webhook_endpoint_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_ycloud_config IS
  'Credenciales YCloud por automotora. Sin SELECT para authenticated.';

ALTER TABLE public.tenant_ycloud_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_restrict_tenant_ycloud_config ON public.tenant_ycloud_config;
CREATE POLICY tenant_restrict_tenant_ycloud_config ON public.tenant_ycloud_config
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.current_is_legacy_protected() OR tenant_id = public.current_tenant_id());

CREATE OR REPLACE VIEW public.tenant_ycloud_config_public
WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  status,
  (webhook_secret IS NOT NULL AND ycloud_webhook_endpoint_id IS NOT NULL) AS webhook_configured,
  (api_key IS NOT NULL AND length(trim(api_key)) > 0) AS api_key_configured,
  updated_at
FROM public.tenant_ycloud_config;

GRANT SELECT ON public.tenant_ycloud_config_public TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Provider ycloud en whatsapp_inboxes
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.whatsapp_inboxes.status IS
  'Estado de conexión: disconnected | pending | active | error (Meta o YCloud)';

-- ---------------------------------------------------------------------------
-- 3) Idempotencia webhooks WhatsApp
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_provider_message_id
  ON public.messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL AND provider IS NOT NULL;
