# Vitrina pública — Sistema de temas + tokens de marca — Diseño

> Mejora de la personalización del Web Builder. Enfoque A: **design tokens con variables CSS**.
> El mismo motor corre en el preview del editor y en la web pública → "lo que editás = lo que se publica".

## Objetivo

El gerente elige un **tema** (Moderna / Tradicional / Premium) y la web se ve bien sin tocar nada.
Encima del tema puede ajustar su **marca**: color primario, secundario, tipografía (par curado),
logo y favicon. Cambiar de tema **nunca** borra contenido ni secciones.

## Decisiones (del brainstorming)

- Control de estilo = **plantillas/temas** (no granular por sección).
- Tema = **solo look** (colores, tipografías, bordes, sombras, espaciado). Mismas secciones.
- Marca editable encima del tema: **logo, favicon, color primario, color secundario, tipografía**.
- Claro/oscuro lo define el tema (no hay toggle suelto por sitio).

## Arquitectura

### Tokens (`src/lib/website/theme.ts`)

```ts
interface DesignTokens {
  colorBg: string; colorSurface: string; colorFg: string; colorMuted: string;
  colorPrimary: string; colorPrimaryFg: string; colorSecondary: string; colorBorder: string;
  fontHeading: string; fontBody: string;
  radius: string;        // ej "0.75rem"
  shadow: string;        // box-shadow de cards
  spaceSection: string;  // padding vertical de secciones, ej "4rem"
}
```

- `THEME_PRESETS: Record<ThemeId, DesignTokens>` con 3 presets:
  - **moderna**: claro, limpio, bordes redondeados, sombras suaves. Poppins/Inter.
  - **tradicional**: claro, serif editorial, bordes rectos. Playfair Display/Lora.
  - **premium**: oscuro, dorado, espaciado amplio. Montserrat/Inter.
- `FONT_PAIRS: Record<FontId, {heading,body,googleFamilies}>` — 4 pares curados:
  `poppins-inter`, `playfair-lora`, `montserrat-roboto`, `space-inter`.
- `buildTokens(site)` (función **pura**): toma el preset del `site.theme` y **pisa**:
  - `colorPrimary` ← `site.primary_color` (si está); recalcula `colorPrimaryFg` por luminancia (negro/blanco legible).
  - `colorSecondary` ← `site.secondary_color` (si está).
  - `fontHeading/Body` ← par de `site.font` (si está).
- `tokensToCssVars(tokens)` → `Record<string,string>` con `--sm-*` para inyectar inline.
- `readableFg(hex)` → `#000`/`#fff` según luminancia relativa (WCAG simplificado). Esta es la
  única "matemática de color"; testeable.

### Provider (`src/components/website/SiteThemeProvider.tsx`)

- `div` que recibe `tokens`, setea `style={cssVars}` y `font-family` base, y monta el `<link>`
  de Google Fonts de las familias necesarias (en preview). En la web pública (Fase 2) el `<link>`
  va en el `<head>` del documento.
- Los bloques usan `var(--sm-color-primary)`, etc. (vía `style` o clases utilitarias arbitrarias).

### Bloques (refactor)

- `HeroBlock` y `VehiclesBlock` dejan de usar `primaryColor` hardcodeado y pasan a tokens.
- `HeroBlock`: muestra `logo` (si hay) arriba; usa `fontHeading`, `colorPrimary` para el botón,
  fondo según imagen o gradiente con tokens.
- `VehiclesBlock`: cards usan `colorSurface`, `colorBorder`, `radius`, `shadow`; precio en `colorPrimary`.
- `SitePreview` se envuelve en `SiteThemeProvider`.

### Editor (`VisualEditor.tsx`)

- Nuevo panel **"Diseño"** arriba del de "Ajustes generales":
  - Selector de **tema**: 3 tarjetas (preview de paleta) → set `theme`.
  - **Tipografía**: select de los 4 pares curados → set `font`.
  - **Color primario** y **secundario**: color pickers (ya existe primario; sumar secundario).
  - **Logo** y **Favicon**: upload vía `useUploadSiteImage` (bucket `site-assets`, ya aislado por tenant).
- Todo dispara `markDirty()`; guardar persiste `theme, font, primary_color, secondary_color, logo_url, favicon_url` + `sections`.

### Datos (BD)

- `tenant_sites`: ya existen `theme, logo_url, primary_color, secondary_color`.
- **Migración nueva**: `ALTER TABLE tenant_sites ADD COLUMN font text; ADD COLUMN favicon_url text;`
  (no destructivo, sin tocar RLS). Default `font` = NULL (cae al par del tema).

## Manejo de errores

- Upload: validación de tipo/tamaño + toast (ya implementado).
- Color inválido: el `input[type=color]` restringe; el input de texto cae al token del tema si vacío.
- Carga de fuente falla: fallback a stack del sistema (`fontBody` siempre incluye fallback).
- `buildTokens` nunca lanza: si `theme` es desconocido, usa `moderna`.

## Testing

- Unit (Vitest) de `theme.ts`:
  - `buildTokens` aplica overrides de marca sobre el preset y respeta precedencia.
  - `readableFg` devuelve `#fff` sobre fondo oscuro y `#000` sobre claro.
  - `buildTokens` con `theme` inválido → preset `moderna` (no throw).

## Fuera de alcance (YAGNI v1)

- Header/nav y footer como bloques propios (el logo va en el Hero por ahora).
- Layouts alternativos por bloque (eso sería "look + layout", descartado).
- Modo claro/oscuro como toggle por sitio.
- Edición inline en el preview (clic-para-editar).

## Orden de implementación (lo difícil primero)

1. `theme.ts`: tipos, presets, `buildTokens`, `readableFg`, `tokensToCssVars` (+ tests).
2. `SiteThemeProvider` + carga de fuentes.
3. Refactor `HeroBlock` + `VehiclesBlock` a tokens; envolver `SitePreview`.
4. Migración `font` + `favicon_url` + regenerar/extender tipos.
5. Panel "Diseño" en el editor (tema, fuente, colores, logo, favicon). ← parte "chill".
