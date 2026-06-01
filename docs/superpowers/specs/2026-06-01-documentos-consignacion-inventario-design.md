# Documentos — hub por vehículo, editor y plantillas por tenant

## Objetivo

Desde **Documentos**, al hacer clic en un vehículo se abre el contrato de consignación con datos tomados de **Consignaciones** (propietario, precios, patente, motor, etc.), no solo del inventario. Cada **tenant** define sus cláusulas legales en plantillas propias.

## Flujo

1. `/app/documents` — tabla vehículo → badges de documentos / consignación activa.
2. Clic en fila → `/app/documents/vehiculo/:vehicleId?tipo=consignacion`.
3. Resolver consignación (`vehicle_id`, fallback `patente`).
4. Si existe documento no anulado → editar; si no → crear borrador prellenado + plantilla del tenant.
5. Panel lateral: editar datos, secciones, densidad, imprimir, refrescar desde consignación.

## Datos

- Tabla `document_templates` (tenant_id, type, clauses JSONB, settings JSONB).
- `documents`: `template_id`, `layout_settings`, `min_sale_price`, `vehicle_motor`, `vehicle_chasis`.

## Inventario

Sin cambio en el modal de detalle del auto. Consignaciones → botón contrato abre el editor si hay `vehicle_id`.

## Pendiente

- Aplicar migración `20260601120000_document_templates_tenant.sql` en Supabase.
- Reserva / venta en el mismo editor.
- Logo y RUT de automotora en cabecera.
- Dedupe por patente al crear consignación.
