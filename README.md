# 🚗 Skale Motors - CRM Automotriz Inteligente

> Sistema CRM completo para concesionarias automotrices con IA integrada, automatización de procesos y análisis avanzado.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff.svg)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-3ecf8e.svg)](https://supabase.com/)

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Scripts Disponibles](#-scripts-disponibles)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Integraciones](#-integraciones)
- [Seguridad](#-seguridad)
- [Documentación](#-documentación)

## ✨ Características

### Core Features
- 📊 **Dashboard Ejecutivo** - Analytics en tiempo real con métricas de negocio
- 🚙 **Gestión de Inventario** - Control completo de vehículos y stock
- 👥 **CRM de Leads** - Seguimiento de clientes potenciales y conversiones
- 📅 **Sistema de Citas** - Calendario integrado con Google Calendar
- 💬 **WhatsApp Integration** - Comunicación directa con clientes
- 🤖 **Studio IA** - Constructor de agentes y automatizaciones con N8N

### Tecnología Avanzada
- ⚡ Interfaz ultra-rápida con React 18 y Vite
- 🎨 UI/UX profesional con Tailwind CSS y shadcn/ui
- 🔒 Autenticación segura con Supabase Auth
- 📱 Diseño responsive y mobile-first
- 🌙 Modo oscuro integrado
- ♿ Accesibilidad WCAG 2.1 AA

## 🛠 Tecnologías

### Frontend
- **React 18.3** - Biblioteca de UI
- **TypeScript 5.8** - Tipado estático
- **Vite 5.4** - Build tool y dev server
- **Tailwind CSS 3.4** - Framework de CSS
- **shadcn/ui** - Componentes de UI
- **Framer Motion** - Animaciones
- **Recharts** - Visualización de datos
- **React Router 6** - Routing

### Backend & Database
- **Supabase** - Backend as a Service
  - PostgreSQL - Base de datos
  - Row Level Security (RLS)
  - Realtime subscriptions
  - Edge Functions
  - Storage

### Integraciones
- **N8N** - Automatización de workflows
- **Google Calendar API** - Gestión de citas
- **WhatsApp Business API** (Meta) - Mensajería
- **SimpleFACTURA** - Facturación electrónica

## 📦 Requisitos Previos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 o **bun** >= 1.0.0
- **Git**
- Cuenta de **Supabase**

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/skale-motors.git
cd skale-motors
```

### 2. Instalar dependencias

```bash
npm install
# o si usas bun
bun install
```

### 3. Configurar variables de entorno

```bash
cp env.example .env
```

Edita el archivo `.env` con tus credenciales:

```env
# Supabase
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_publica

# Environment
VITE_APP_ENV=development

# Node scripts (backend)
SUPABASE_URL=tu_url_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_clave_secreta
```

### 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## ⚙️ Configuración

### Base de Datos

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ejecuta los scripts de migración:

```bash
# Configurar políticas RLS
psql -h db.xxx.supabase.co -U postgres -d postgres -f scripts/setup-rls-policies.sql

# Configurar N8N workspaces
psql -h db.xxx.supabase.co -U postgres -d postgres -f scripts/n8n_workspaces_setup.sql
```

### Crear Usuario de Prueba

```bash
npm run create:user
```

## 📜 Scripts Disponibles

```json
{
  "dev": "Inicia el servidor de desarrollo",
  "build": "Compila para producción",
  "build:dev": "Compila en modo desarrollo",
  "lint": "Ejecuta el linter",
  "preview": "Vista previa del build de producción",
  "create:user": "Script para crear usuarios de prueba"
}
```

### Comandos comunes

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview

# Linting
npm run lint
```

## 📁 Estructura del Proyecto

```
skale-motors/
├── public/                 # Archivos estáticos
├── src/
│   ├── components/        # Componentes React
│   │   ├── ui/           # Componentes de shadcn/ui
│   │   └── ...           # Componentes custom
│   ├── contexts/         # Context providers
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilidades y servicios
│   │   ├── services/    # Servicios de API
│   │   └── types/       # Tipos TypeScript
│   ├── pages/            # Páginas de la aplicación
│   └── styles/           # Estilos globales
├── scripts/              # Scripts de utilidad
├── supabase/            # Configuración de Supabase
│   ├── functions/       # Edge Functions
│   └── config.toml      # Configuración local
├── docs/                # Documentación adicional
└── workflows/           # Templates de N8N

```

## 🔌 Integraciones

### Google Calendar
Ver [GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md) para configuración completa.

### N8N (Automatización)
Ver [docs/N8N_INTEGRATION_README.md](./docs/N8N_INTEGRATION_README.md) para workflows y configuración.

### WhatsApp Business
- [META_WHATSAPP_SETUP.md](./META_WHATSAPP_SETUP.md) - Mensajería (Meta)

### SimpleFACTURA
Ver [SIMPLEFACTURA_SETUP.md](./SIMPLEFACTURA_SETUP.md) para integración de facturación.

### Marketplaces (Mercado Libre, Facebook, Chile Autos)
Ver [docs/MARKETPLACES_SETUP.md](./docs/MARKETPLACES_SETUP.md) para publicar vehículos en marketplaces.

## 🔒 Seguridad

- ✅ Row Level Security (RLS) habilitado en todas las tablas
- ✅ Autenticación JWT con Supabase
- ✅ Variables de entorno para datos sensibles
- ✅ Validación de datos con Zod
- ✅ Sanitización de inputs

Ver [SEGURIDAD.md](./SEGURIDAD.md) para más detalles.

## 📚 Documentación

### Guías de Usuario
- [GUIA_IMPLEMENTACION.md](./GUIA_IMPLEMENTACION.md) - Guía completa de implementación
- [MIGRACION_PRODUCCION.md](./MIGRACION_PRODUCCION.md) - Deploy a producción

### Documentación Técnica
- [docs/README.md](./docs/README.md) - Índice de documentación y estado del proyecto
- [docs/N8N_INTEGRATION_README.md](./docs/N8N_INTEGRATION_README.md) - Integración N8N y Studio IA
- [docs/n8n_docker_setup.md](./docs/n8n_docker_setup.md) - Setup de N8N con Docker
- [docs/n8n_usage_examples.md](./docs/n8n_usage_examples.md) - Ejemplos de uso
- [docs/MARKETPLACES_SETUP.md](./docs/MARKETPLACES_SETUP.md) - Mercado Libre, Facebook Marketplace, Chile Autos

## 🚀 Deployment

### Producción con Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Variables de Entorno en Producción

Asegúrate de configurar todas las variables en tu plataforma de hosting:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV=production`

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: nueva funcionalidad increíble'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Convención de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bugs
- `docs:` Cambios en documentación
- `style:` Formato, punto y coma, etc
- `refactor:` Refactorización de código
- `test:` Añadir tests
- `chore:` Mantenimiento

## 📄 Licencia

Este proyecto es privado y confidencial.

## 👥 Equipo

Desarrollado por el equipo de Skale Motors

---

**¿Necesitas ayuda?** Revisa la documentación o contacta al equipo de desarrollo.
