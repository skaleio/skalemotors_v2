-- Rol fotógrafo: inventario (fotos) y alertas de stock visual.
-- users.role es TEXT sin enum; esta migración documenta el valor y actualiza RPCs que listan roles.

COMMENT ON COLUMN public.users.role IS
  'RBAC: admin, gerente, jefe_jefe, jefe_sucursal, vendedor, fotografo, financiero, servicio, inventario';
