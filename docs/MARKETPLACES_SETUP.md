# Configuración de integración con marketplaces

Skalemotors permite conectar **Mercado Libre**, **Facebook Marketplace** y **Chile Autos** para publicar vehículos desde Inventario y desde la página Publicaciones.

## Desplegar Edge Functions

Las funciones se ejecutan en Supabase. Despliega con:

```bash
supabase functions deploy marketplace-connect
supabase functions deploy marketplace-publish
supabase functions deploy marketplace-sync
```

O todas a la vez:

```bash
supabase functions deploy marketplace-connect marketplace-publish marketplace-sync
```

Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` se inyectan automáticamente en el proyecto. Opcionalmente, en **Project Settings → Edge Functions → Secrets** puedes definir:

- **CHILEAUTOS_API_URL**: si Chile Autos te indica una URL base distinta a la por defecto.

## Cómo conectar cada plataforma

### 1. Mercado Libre (Chile)

1. Crea una aplicación en [developers.mercadolibre.cl](https://developers.mercadolibre.cl).
2. Obtén un **Access Token** (OAuth o token de prueba). Para producción con vehículos necesitas el **paquete de publicación** (Silver) contratado con el equipo comercial de Mercado Libre.
3. En **Publicaciones → Conectar plataformas → Mercado Libre** pega el Access Token y conecta.

### 2. Facebook Marketplace

1. Crea una app en [developers.facebook.com](https://developers.facebook.com) y solicita permisos de **Catálogo de productos** y **Gestión de negocio**.
2. Crea o obtén el **Product Catalog** para vehículos y anota el **Catalog ID**.
3. Genera un **Access Token** con permisos sobre ese catálogo.
4. En **Publicaciones → Conectar plataformas → Facebook Marketplace** ingresa el Catalog ID y el Access Token y conecta.

### 3. Chile Autos

1. Contacta a **soporte@chileautos.cl** para obtener acceso a la **Global Inventory API v2.0**.
2. Te entregarán **Client ID**, **Client Secret** y **Seller Identifier**.
3. En **Publicaciones → Conectar plataformas → Chile Autos** ingresa esos tres valores y conecta.

## Uso

- **Publicaciones**: desde la página **Publicaciones** puedes conectar/desconectar plataformas, ver el estado de cada listado y usar **Sincronizar todo** para publicar todos los vehículos disponibles en las plataformas conectadas.
- **Inventario**: en cada fila de vehículo aparece la columna **Portales** (ML, FB, Chile) y en el menú de acciones **Publicar en Mercado Libre / Facebook / Chile Autos** para publicar ese vehículo en la plataforma que ya tengas conectada.

Los datos de conexión se guardan en Supabase por sucursal y no se exponen al navegador; solo las Edge Functions los usan para llamar a las APIs de cada plataforma.
