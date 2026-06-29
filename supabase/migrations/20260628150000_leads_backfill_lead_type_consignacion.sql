-- Backfill: leads viejos del módulo Consignaciones quedan marcados como lead_type='consignacion'.
-- Antes de esta columna, esos leads solo se distinguían por un tag 'consignacion:<label>'.
-- Idempotente: re-ejecutar no cambia nada.
UPDATE public.leads
SET lead_type = 'consignacion'
WHERE lead_type <> 'consignacion'
  AND jsonb_typeof(tags) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(tags) AS t
    WHERE t LIKE 'consignacion:%'
  );
