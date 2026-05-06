-- Color del vendedor en el CRM (tarjetas de leads, leyendas).
-- Formato #RRGGBB. Nullable: sin color se usa paleta derivada del id en el cliente.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS crm_color text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_crm_color_format;

ALTER TABLE public.users
  ADD CONSTRAINT users_crm_color_format
  CHECK (
    crm_color IS NULL
    OR crm_color ~ '^#[0-9A-Fa-f]{6}$'
  );

COMMENT ON COLUMN public.users.crm_color IS
  'Color hex (#RRGGBB) para identificar al vendedor en el CRM; el usuario lo elige en Configuración.';
