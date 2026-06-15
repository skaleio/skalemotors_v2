-- El rol 'fotografo' está soportado de punta a punta en el front (appRoles.ts:
-- guards de rutas, permisos de inventario, home en /app/consignaciones) y la
-- notificación notify_consignacion_created lo resuelve como destinatario.
-- Pero users_role_check nunca lo incluyó: la migración 20260529120000 solo
-- agregó un COMMENT, no tocó el constraint, así que ningún usuario podía
-- tener role='fotografo' y la notificación no tenía a quién llegar.
-- Ampliamos el CHECK para habilitarlo (solo agrega un valor permitido).

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role = any (array[
    'admin', 'gerente', 'vendedor', 'financiero', 'servicio', 'inventario', 'fotografo'
  ]::text[]));
