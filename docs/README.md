# 📚 Documentación - Skale Motors

Índice de documentación y visión clara del estado del proyecto.

---

## 📋 Índice de documentación

### Raíz del proyecto

| Documento | Uso |
|-----------|-----|
| [../README.md](../README.md) | Punto de entrada: instalación, stack, scripts |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Guía de contribución y estándares de código |
| [../CHANGELOG.md](../CHANGELOG.md) | Historial de cambios |
| [../SECURITY.md](../SECURITY.md) | Política de reporte de vulnerabilidades |
| [../SEGURIDAD.md](../SEGURIDAD.md) | Guía detallada de seguridad (RLS, auth, buenas prácticas) |
| [../GUIA_IMPLEMENTACION.md](../GUIA_IMPLEMENTACION.md) | Guía paso a paso de implementación / migración |
| [../MIGRACION_PRODUCCION.md](../MIGRACION_PRODUCCION.md) | Plan de migración y deploy a producción |

### Setup por integración

| Documento | Integración |
|-----------|-------------|
| [../GOOGLE_CALENDAR_SETUP.md](../GOOGLE_CALENDAR_SETUP.md) | Google Calendar (citas) |
| [../WHATSAPP_YCLOUD_SETUP.md](../WHATSAPP_YCLOUD_SETUP.md) | WhatsApp mensajería (YCloud) |
| [../WHATSAPP_CALLING_API_SETUP.md](../WHATSAPP_CALLING_API_SETUP.md) | WhatsApp llamadas |
| [../SIMPLEFACTURA_SETUP.md](../SIMPLEFACTURA_SETUP.md) | Facturación electrónica |
| [MARKETPLACES_SETUP.md](./MARKETPLACES_SETUP.md) | Mercado Libre, Facebook Marketplace, Chile Autos |

### N8N y Studio IA

| Documento | Contenido |
|-----------|-----------|
| [N8N_INTEGRATION_README.md](./N8N_INTEGRATION_README.md) | Arquitectura, multi-tenant, flujos, servicio n8n |
| [n8n_docker_setup.md](./n8n_docker_setup.md) | Instalación de n8n con Docker |
| [n8n_usage_examples.md](./n8n_usage_examples.md) | Ejemplos de uso (WhatsApp, leads, etc.) |
| [n8n_workflows_templates.md](./n8n_workflows_templates.md) | Templates de workflows |

### Planes y roadmap

| Documento | Contenido |
|-----------|-----------|
| [PLAN_TAREAS_PENDIENTES_LLM.md](./PLAN_TAREAS_PENDIENTES_LLM.md) | Tareas pendientes con datos reales, LLM, n8n/WhatsApp |

---

## ✅ Qué tenemos (implementado)

### Core

- **Dashboard ejecutivo** – KPIs, gráficos, métricas en tiempo real
- **Inventario** – Vehículos, stock, listados, publicaciones
- **CRM / Leads** – Gestión de leads, estados, asignación, board
- **Citas** – Calendario con sincronización Google Calendar (OAuth, crear/editar/eliminar)
- **Ventas** – Gestión de ventas y comisiones
- **Usuarios y roles** – Admin, gerente, vendedor, financiero, servicio, inventario (RLS por sucursal)

### Integraciones

- **Supabase** – Auth, PostgreSQL, RLS, Edge Functions, Storage, Realtime
- **Google Calendar** – Sincronización bidireccional de eventos
- **WhatsApp (YCloud)** – Mensajería y webhook
- **WhatsApp Calling** – Llamadas
- **N8N** – Workspaces por sucursal, agente IA, automatizaciones, webhooks (lead-state-update, etc.)
- **SimpleFACTURA** – Facturación electrónica
- **Marketplaces** – Edge Functions: Mercado Libre, Facebook Marketplace, Chile Autos (connect, publish, sync)

### Studio IA

- Constructor de agentes IA integrado con n8n
- Reglas de automatización
- Conexiones WhatsApp/Instagram
- Herramientas: descripciones vehículos, guiones, posts, logos, SEO, ads, etc.

### Infra y calidad

- React 18 + TypeScript + Vite
- Tailwind + shadcn/ui
- Modo oscuro, responsive, accesibilidad
- RLS en tablas, validación Zod, variables de entorno

---

## 📁 Cómo está organizado

```
skalemotors_v2/
├── src/
│   ├── components/     # UI (shadcn), layout, sidebar, builders (AIAgent, AutomationRules)
│   ├── contexts/      # Auth, Theme, Chat
│   ├── hooks/         # useVehicles, useLeads, useAppointments, usePendingTasks, etc.
│   ├── lib/           # supabase, services/*.ts, types
│   └── pages/         # Rutas: Dashboard, CRM, Inventory, Studio IA, etc.
├── supabase/functions/  # Edge Functions (lead-state-update, marketplace-*, whatsapp-*, etc.)
├── scripts/           # SQL (RLS, n8n_workspaces, demo users, migraciones)
├── docs/              # Documentación (este índice + guías)
└── workflows/         # Ejemplos/templates N8N
```

---

## 🔜 Qué falta por implementar (referencia)

- **Tareas pendientes con datos reales**  
  Tarjeta del dashboard alimentada por:
  - Tabla `pending_tasks` en Supabase (diseño en [PLAN_TAREAS_PENDIENTES_LLM.md](./PLAN_TAREAS_PENDIENTES_LLM.md))
  - Edge Function `pending-task-create` para n8n/WhatsApp
  - Reglas automáticas o LLM para consolidar alertas (leads sin contactar, seguimientos vencidos, citas sin confirmar)
  - Flujo WhatsApp → “recordatorio” → n8n → `pending-task-create`

- **Otros posibles** (según prioridad de negocio):
  - Tests automatizados (unitarios/e2e)
  - Más integraciones o mejoras en las existentes
  - Ajustes de UX/rendimiento según uso real

Para el detalle técnico de tareas pendientes, ver [PLAN_TAREAS_PENDIENTES_LLM.md](./PLAN_TAREAS_PENDIENTES_LLM.md).

---

## 🔧 Calidad de código

- **Build**: el proyecto compila correctamente con `npm run build`.
- **Lint**: existen avisos/errores previos (p. ej. `@typescript-eslint/no-explicit-any`, `react-hooks/exhaustive-deps`) que se pueden ir corrigiendo en iteraciones sin afectar la funcionalidad.
