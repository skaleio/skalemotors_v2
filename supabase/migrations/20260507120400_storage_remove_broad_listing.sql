-- Fix advisor: public_bucket_allows_listing
-- Los buckets `vehicles` y `avatars` son public=true, por lo que el acceso GET por URL
-- directa funciona sin policies. La policy SELECT "broad" sobre storage.objects es la
-- que habilita el LIST de TODOS los archivos, lo cual expone metadata cross-tenant.
--
-- Frontend uso de list():
--   - src/pages/Settings.tsx:518 → list(user.id) en bucket avatars (folder propio)
-- Vehicles bucket: no usa list() en el frontend.
--
-- Acción:
--   - Drop "Public Access for vehicle images" (broad SELECT en vehicles)
--   - Drop "Avatar images are publicly accessible" (broad SELECT en avatars)
--   - Reemplazar avatars por SELECT scoped al folder del propio usuario.

DROP POLICY IF EXISTS "Public Access for vehicle images" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- avatars: el usuario solo puede listar SU PROPIO folder (folder = uid)
CREATE POLICY "avatars_authenticated_list_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- vehicles: solo authenticated puede listar (uso interno; el GET publico via URL sigue funcionando)
CREATE POLICY "vehicles_authenticated_list" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vehicles');
