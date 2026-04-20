-- Primera imagen del vehículo como texto (para listados sin cargar el JSON completo de images).
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS primary_image_url text
  GENERATED ALWAYS AS (
    CASE
      WHEN images IS NULL THEN NULL
      WHEN jsonb_typeof(images::jsonb) = 'array' AND jsonb_array_length(images::jsonb) > 0
      THEN NULLIF(trim(images::jsonb->>0), '')
      ELSE NULL
    END
  ) STORED;

COMMENT ON COLUMN public.vehicles.primary_image_url IS 'Primera URL del array images; derivada para listados y miniaturas.';
