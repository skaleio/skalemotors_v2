# 🤝 Guía de Contribución

¡Gracias por tu interés en contribuir a Skale Motors! Esta guía te ayudará a entender cómo trabajamos.

## 📋 Tabla de Contenidos

1. [Código de Conducta](#código-de-conducta)
2. [Cómo Empezar](#cómo-empezar)
3. [Proceso de Desarrollo](#proceso-de-desarrollo)
4. [Estándares de Código](#estándares-de-código)
5. [Commits](#commits)
6. [Pull Requests](#pull-requests)

## 📜 Código de Conducta

- Sé respetuoso y profesional
- Acepta críticas constructivas
- Enfócate en lo mejor para el proyecto
- Colabora de manera abierta

## 🚀 Cómo Empezar

### 1. Fork y Clone

```bash
# Fork el repositorio desde GitHub
# Luego clona tu fork
git clone https://github.com/tu-usuario/skale-motors.git
cd skale-motors
```

### 2. Configurar el Proyecto

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp env.example .env

# Iniciar desarrollo
npm run dev
```

### 3. Crear una Rama

```bash
# Siempre crea una rama desde main
git checkout main
git pull origin main
git checkout -b tipo/descripcion-corta
```

**Tipos de ramas:**
- `feat/` - Nueva funcionalidad
- `fix/` - Corrección de bugs
- `docs/` - Documentación
- `refactor/` - Refactorización
- `style/` - Estilos y formato
- `test/` - Tests
- `chore/` - Mantenimiento

**Ejemplos:**
```bash
git checkout -b feat/whatsapp-templates
git checkout -b fix/dashboard-loading
git checkout -b docs/api-documentation
```

## 💻 Proceso de Desarrollo

### 1. Desarrollo Local

```bash
# Asegúrate de que todo funciona antes de commitear
npm run dev
npm run lint
npm run build
```

### 2. Testing

- Prueba tu código manualmente
- Verifica que no rompiste funcionalidad existente
- Asegúrate de que funciona en diferentes navegadores

### 3. Linting

```bash
# El linter debe pasar sin errores
npm run lint
```

## 📝 Estándares de Código

### TypeScript

```typescript
// ✅ BIEN - Tipos explícitos
interface User {
  id: string;
  name: string;
  email: string;
}

const getUser = async (id: string): Promise<User> => {
  // ...
}

// ❌ MAL - Sin tipos
const getUser = async (id) => {
  // ...
}
```

### React Components

```tsx
// ✅ BIEN - Componente funcional con tipos
import { FC } from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

export const Button: FC<ButtonProps> = ({ label, onClick, variant = "primary" }) => {
  return (
    <button onClick={onClick} className={`btn-${variant}`}>
      {label}
    </button>
  );
};

// ❌ MAL - Sin tipos ni props interface
export const Button = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
```

### Imports

```typescript
// ✅ BIEN - Imports organizados
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// ❌ MAL - Imports desordenados
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
```

### Naming Conventions

```typescript
// Componentes - PascalCase
export const UserProfile = () => {};

// Funciones - camelCase
const getUserData = () => {};

// Constantes - UPPER_SNAKE_CASE
const API_BASE_URL = "https://api.example.com";

// Interfaces/Types - PascalCase con I prefix opcional
interface IUserData {}
type UserData = {};

// Archivos
// Componentes: UserProfile.tsx
// Hooks: useUserData.ts
// Utils: formatDate.ts
// Types: user.types.ts
```

## 📦 Commits

### Conventional Commits

Usamos el estándar de [Conventional Commits](https://www.conventionalcommits.org/):

```
tipo(ámbito opcional): descripción corta

[cuerpo opcional]

[footer opcional]
```

### Tipos de Commit

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `feat` | Nueva funcionalidad | `feat: agregar filtros en dashboard` |
| `fix` | Corrección de bugs | `fix: corregir carga de vehículos` |
| `docs` | Documentación | `docs: actualizar README` |
| `style` | Formato de código | `style: aplicar prettier a components` |
| `refactor` | Refactorización | `refactor: optimizar queries de dashboard` |
| `perf` | Mejoras de rendimiento | `perf: implementar lazy loading` |
| `test` | Tests | `test: agregar tests unitarios` |
| `chore` | Mantenimiento | `chore: actualizar dependencias` |
| `ci` | CI/CD | `ci: configurar GitHub Actions` |

### Ejemplos de Buenos Commits

```bash
# ✅ BIEN
git commit -m "feat: agregar integración con WhatsApp Business API"
git commit -m "fix: corregir error en cálculo de comisiones"
git commit -m "docs: actualizar guía de instalación"
git commit -m "refactor: simplificar lógica de autenticación"

# ❌ MAL
git commit -m "cambios"
git commit -m "fix"
git commit -m "WIP"
git commit -m "ajustes varios"
```

### Con Ámbito

```bash
git commit -m "feat(dashboard): agregar gráfico de conversión"
git commit -m "fix(auth): corregir redirección después del login"
git commit -m "docs(api): documentar endpoints de vehículos"
```

### Commits con Cuerpo

```bash
git commit -m "feat: implementar sistema de notificaciones

- Agregar servicio de notificaciones push
- Crear componente NotificationCenter
- Integrar con Supabase Realtime
- Agregar preferencias de usuario

Closes #123"
```

## 🔄 Pull Requests

### Antes de Crear un PR

- [ ] El código compila sin errores (`npm run build`)
- [ ] El linter pasa (`npm run lint`)
- [ ] Has probado tu código localmente
- [ ] Los commits siguen el estándar
- [ ] Has actualizado la documentación si es necesario

### Crear un Pull Request

1. **Push tu rama**
```bash
git push origin feat/tu-feature
```

2. **Abre el PR en GitHub**

3. **Completa la plantilla del PR**

```markdown
## Descripción
Breve descripción de los cambios

## Tipo de cambio
- [ ] Bug fix
- [ ] Nueva funcionalidad
- [ ] Breaking change
- [ ] Documentación

## ¿Cómo se ha probado?
Describe cómo probaste los cambios

## Checklist
- [ ] Mi código sigue los estándares del proyecto
- [ ] He revisado mi propio código
- [ ] He comentado código complejo
- [ ] He actualizado la documentación
- [ ] Mis cambios no generan warnings
- [ ] He probado en diferentes navegadores
```

### Título del PR

```bash
# ✅ BIEN
feat: agregar sistema de notificaciones en tiempo real
fix: corregir error en dashboard ejecutivo
docs: actualizar guía de integración con N8N

# ❌ MAL
Cambios en el dashboard
Fix
Updates
```

### Revisión del PR

- Responde a los comentarios de manera constructiva
- Haz los cambios solicitados
- Solicita revisión nuevamente cuando esté listo

## 🐛 Reportar Bugs

### Crear un Issue

1. Busca si el bug ya fue reportado
2. Usa la plantilla de bug report
3. Incluye:
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento esperado
   - Comportamiento actual
   - Screenshots si aplica
   - Información del ambiente (navegador, OS, etc.)

### Ejemplo de Bug Report

```markdown
**Describe el bug**
El dashboard ejecutivo no carga las métricas cuando hay más de 1000 vehículos

**Pasos para reproducir**
1. Ir al Dashboard Ejecutivo
2. Tener más de 1000 vehículos en inventario
3. El loading no termina nunca

**Comportamiento esperado**
Las métricas deberían cargar en menos de 3 segundos

**Screenshots**
[Adjuntar screenshot]

**Ambiente**
- Navegador: Chrome 120
- OS: Windows 11
- Versión: main branch
```

## 💡 Sugerir Funcionalidades

1. Abre un Issue con la etiqueta `enhancement`
2. Describe claramente la funcionalidad
3. Explica por qué sería útil
4. Si es posible, sugiere una implementación

## ❓ Preguntas

Si tienes preguntas:
1. Revisa la documentación
2. Busca en los Issues cerrados
3. Crea un nuevo Issue con la etiqueta `question`

---

¡Gracias por contribuir a Skale Motors! 🚀
