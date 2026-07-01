-- Hardening: cerrar la superficie pública de la vista public_vehicles.
--
-- La vitrina web (Miami y futuros tenants) ahora consume la Edge Function
-- public-vitrina, que lee la tabla vehicles con service role y devuelve solo
-- columnas seguras. La vista public_vehicles ya no tiene consumidores vía
-- PostgREST (grep en src/ = 0 usos; el server Hono que la usaba fue eliminado).
--
-- Revocamos el SELECT de anon y authenticated para eliminar el hallazgo
-- security_definer_view (facing EXTERNAL): sin grant, la vista deja de ser
-- accesible por la API REST. La definición se conserva por si se reactiva
-- el acceso directo en el futuro.
REVOKE SELECT ON public.public_vehicles FROM anon;
REVOKE SELECT ON public.public_vehicles FROM authenticated;
