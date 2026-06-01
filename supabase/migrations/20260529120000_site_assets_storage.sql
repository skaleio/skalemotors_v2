-- Storage para la vitrina pública (Web Builder): bucket `site-assets`.
-- Cada tenant sube a su propia carpeta: {tenant_id}/archivo.ext
-- Aislamiento: las políticas de escritura validan que la primera carpeta del path
-- coincida con current_tenant_id(). La lectura es pública (bucket public) porque
-- las imágenes se muestran en la vitrina pública.

-- =====================================================================
-- 1. Bucket
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================================
-- 2. Políticas en storage.objects
-- =====================================================================

-- Lectura pública (vitrina). Cualquier rol puede leer objetos del bucket.
drop policy if exists site_assets_public_read on storage.objects;
create policy site_assets_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'site-assets');

-- Insert: el authenticated solo puede subir dentro de la carpeta de su tenant.
drop policy if exists site_assets_tenant_insert on storage.objects;
create policy site_assets_tenant_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'site-assets'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- Update: solo objetos dentro de la carpeta del tenant.
drop policy if exists site_assets_tenant_update on storage.objects;
create policy site_assets_tenant_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'site-assets'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
  with check (
    bucket_id = 'site-assets'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- Delete: solo objetos dentro de la carpeta del tenant.
drop policy if exists site_assets_tenant_delete on storage.objects;
create policy site_assets_tenant_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'site-assets'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
