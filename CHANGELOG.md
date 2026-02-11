# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Changed
- Limpieza de documentación: eliminados 6 archivos .md obsoletos o redundantes (README_MIGRACION, INTEGRACION_*_COMPLETADA, MEJORAS_DASHBOARD_INVENTARIO, REORGANIZACION_STUDIO_IA, SOLUCION_CARGA_INFINITA).
- Nuevo `docs/README.md` como índice de documentación y visión del estado del proyecto (qué hay, cómo está organizado, qué falta).
- README principal actualizado con enlaces a docs/README.md, N8N_INTEGRATION_README y MARKETPLACES_SETUP.
- Pequeñas correcciones de lint sin cambiar comportamiento (BlurText, Iridescence, Onboarding case block, command/textarea types, tailwind import).

### Added
- Sistema de gestión de inventario de vehículos
- Dashboard ejecutivo con métricas en tiempo real
- CRM para gestión de leads y clientes
- Sistema de citas integrado con Google Calendar
- Integración con WhatsApp Business API (YCloud)
- Studio IA para construcción de agentes con N8N
- Automatización de workflows
- Integración con SimpleFACTURA
- Sistema de autenticación con Supabase
- Row Level Security (RLS) en todas las tablas
- Modo oscuro
- Diseño responsive

### Changed
- Reorganización de la estructura del proyecto
- Mejora en la experiencia de usuario del dashboard
- Optimización de queries de base de datos

### Removed
- Archivos SQL temporales y de prueba
- Documentación obsoleta
- Archivos duplicados

## [0.1.0] - 2026-01-22

### Added
- Configuración inicial del proyecto
- Estructura base con React, TypeScript y Vite
- Integración con Supabase
- Componentes de UI con shadcn/ui
- Sistema de routing con React Router
- Configuración de Tailwind CSS

---

## Tipos de Cambios

- `Added` - Para funcionalidades nuevas
- `Changed` - Para cambios en funcionalidades existentes
- `Deprecated` - Para funcionalidades que serán removidas
- `Removed` - Para funcionalidades removidas
- `Fixed` - Para corrección de bugs
- `Security` - Para cambios relacionados con seguridad
