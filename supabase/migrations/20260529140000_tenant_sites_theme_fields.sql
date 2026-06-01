-- Campos de personalización de marca para la vitrina (sistema de temas + tokens).
-- font: id del par de tipografías curado (null = usa el par por defecto del tema).
-- favicon_url: ícono de la pestaña del navegador en la web pública.
-- No destructivo, no toca RLS.

alter table public.tenant_sites
  add column if not exists font text,
  add column if not exists favicon_url text;

comment on column public.tenant_sites.font is
  'Id del par de tipografías curado (poppins-inter, playfair-lora, montserrat-roboto, space-inter). NULL = par por defecto del tema.';
comment on column public.tenant_sites.favicon_url is
  'URL pública del favicon del sitio (bucket site-assets).';
