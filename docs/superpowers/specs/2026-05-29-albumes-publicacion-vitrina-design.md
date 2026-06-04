# Álbumes → publicación vitrina multi-tenant — Diseño

**Fecha:** 2026-05-29  
**Estado:** Aprobado  
**Enfoque:** C (servicio centralizado + trigger BD + UX Álbumes)

## Objetivo

Pipeline operativo: stock → Álbumes (fotos) → un clic publicar → vitrina del tenant (subdominio o dominio propio). Mi Web queda para edición ocasional del sitio.

## Reglas

- **Publicables:** `disponible`, `reservado` (vitrina muestra reservados con badge).
- **Auto-bajar de web:** `vendido`, `vendido_por_dueno`, `retirado`, `en_reparacion`, `fuera_de_servicio` → `publicado_web = false` (trigger).
- **Publicar requiere:** ≥1 foto, precio > 0, estado publicable.
- **Cola “preparación”:** vehículos sin fotos (`images` vacío tras sync).

## Componentes

| Pieza | Responsabilidad |
|-------|-----------------|
| `vehicleWebPublish` service | Validar y setear `publicado_web` |
| `albumQueues` lib | Filtros de pestañas en Álbumes |
| Trigger `vehicles_clear_publicado_web_on_status` | Consistencia al cambiar estado |
| `public-vitrina` | `status IN (disponible, reservado)` + campo `status` |
| `VehiclesBlock` | Badge Reservado en tarjetas |
| `Albums.tsx` | Pestañas + botón Publicar |

## Multi-tenant

Cada tenant: `tenant_sites` + `tenant_domains` + inventario aislado por RLS. La vitrina resuelve tenant por `Host`; nunca por input del cliente.
