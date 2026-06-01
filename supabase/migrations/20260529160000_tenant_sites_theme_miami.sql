-- Tema "miami": vitrina oscura estilo premium (rosado / blanco / negro).
ALTER TABLE public.tenant_sites
  DROP CONSTRAINT IF EXISTS tenant_sites_theme_check;

ALTER TABLE public.tenant_sites
  ADD CONSTRAINT tenant_sites_theme_check
  CHECK (theme IN ('moderna', 'tradicional', 'premium', 'miami'));
