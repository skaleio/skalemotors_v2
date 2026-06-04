-- Idempotente: importa vehicles.images legacy a vehicle_photo_assets si aún no hay filas.
INSERT INTO public.vehicle_photo_assets (tenant_id, vehicle_id, album, url, sort_order, is_cover)
SELECT
  v.tenant_id,
  v.id,
  'General',
  trim(both '"' from elem::text),
  ord::integer,
  (ord = 1)
FROM public.vehicles v
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN v.images IS NULL THEN '[]'::jsonb
    WHEN jsonb_typeof(v.images::jsonb) = 'array' THEN v.images::jsonb
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS t(elem, ord)
WHERE v.tenant_id IS NOT NULL
  AND trim(both '"' from elem::text) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.vehicle_photo_assets a WHERE a.vehicle_id = v.id
  );
