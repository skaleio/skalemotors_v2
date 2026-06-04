-- Portada de consignación u otras referencias: visibles en CRM pero no cuentan para publicar en vitrina.

ALTER TABLE public.vehicle_photo_assets
  ADD COLUMN IF NOT EXISTS counts_for_publish boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.vehicle_photo_assets.counts_for_publish IS
  'false = foto de referencia (ej. portada al crear consignación); no suma al mínimo de fotos de álbum para vitrina.';
