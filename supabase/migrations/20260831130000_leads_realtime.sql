-- Realtime en Leads: que una asignación/edición hecha por otro usuario (p. ej. el admin delega un lead
-- a un vendedor) se refleje al instante en la sesión del vendedor sin recargar.
-- La RLS de leads aplica sobre la publicación: cada usuario solo recibe eventos de los leads que puede ver.
-- REPLICA IDENTITY FULL: necesario para que la RLS de realtime evalúe UPDATE/DELETE con todas las columnas
-- (assigned_to, tenant_id, branch_id), no solo la PK.

ALTER TABLE public.leads REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
