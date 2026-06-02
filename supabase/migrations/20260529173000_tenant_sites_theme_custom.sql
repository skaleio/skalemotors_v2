-- Overrides de design tokens (fondos, texto, bordes, radio) además de primary_color / secondary_color.
alter table public.tenant_sites
  add column if not exists theme_custom jsonb not null default '{}'::jsonb;

comment on column public.tenant_sites.theme_custom is
  'Overrides parciales de tokens CSS (--sm-*): colorBg, colorSurface, colorFg, colorMuted, colorPrimaryFg, colorBorder, radius.';
