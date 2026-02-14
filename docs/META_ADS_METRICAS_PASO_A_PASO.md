# Cómo dejar funcional las métricas de Meta (Facebook/Instagram) Ads

Sigue estos pasos en orden para poder ver campañas y métricas de Meta dentro de Skalemotors.

---

## Modo beta (solo tu automotora, sin publicar la app)

Si estás probando solo con tu automotora y la app está en **modo desarrollo** (Sin publicar), no hace falta completar "Revisión de la app" ni "Verificación del negocio". Solo esto:

### 1. Añadir el caso de uso / producto para Ads

- En el **Panel** de tu app SkaleMotors, haz clic en **Agregar casos de uso**.
- En el modal **"Agrega más casos de uso"**:
  - Si ves el filtro **"Anuncios y monetización"**, selecciónalo para ver solo los de anuncios.
  - **Marca la casilla** del caso de uso: **"Medir datos de rendimiento de los anuncios con la API de marketing"** (es el que permite leer métricas: impresiones, clics, gasto, etc.).
  - Opcional: si quieres también listar/gestionar campañas desde la API, marca **"Crear y administrar anuncios con la API de marketing"**.
  - Clic en **Guardar**.
- Cierra el modal. Con eso la app ya tiene permiso para usar la Marketing API para métricas.

### 2. Sacar el token de prueba (Graph API Explorer)

- Abre **https://developers.facebook.com/tools/explorer/** en otra pestaña.
- Arriba a la derecha, en **Meta App**, elige **SkaleMotors**.
- Clic en **Generar token de acceso** → elige **Usuario** (User Token).
- En permisos, marca: **ads_management**, **ads_read**, **business_management**.
- Acepta y copia el token (empieza por `EAA...`). En modo desarrollo ese token sirve para **tu** cuenta y **tus** cuentas de anuncios.

### 3. (Opcional) Ver tu ID de cuenta de anuncios

- En el mismo Graph API Explorer, en el campo de petición pon: `me/adaccounts` y dale **Enviar**.
- En la respuesta copia el `id` (ej. `act_1234567890`). Lo puedes pegar en Skalemotors en el paso siguiente.

### 4. Conectar en Skalemotors

- Entra a tu app Skalemotors (la web) → menú **Sistema** → **Integraciones**.
- Tarjeta **Meta (Facebook/Instagram) Ads** → **Conectar**.
- Pega el **token** y, si lo tienes, el **ID de cuenta de anuncios** (`act_XXXX`).
- Clic en **Conectar**.

### 5. Ver métricas

- En el menú: **Analytics y herramientas** → **Métricas Meta Ads**.
- Ahí ves campañas y la pestaña **Analytics** (alcance, impresiones, clics, gasto, etc.). Si no hay campañas, créalas en [Meta Ads Manager](https://business.facebook.com/adsmanager).

Con eso tienes las métricas funcionando en modo beta. Cuando más adelante quieras escalar (otros clientes/automotoras), ahí sí tendrás que pasar revisión y verificación de negocio.

---

## Lo que ya está hecho

- Tabla `meta_ads_connections` en Supabase.
- Edge Functions desplegadas: `meta-ads-connect`, `meta-ads-status`, `meta-ads-disconnect`, `meta-ads-campaigns`, `meta-ads-insights`.
- En la app: página Integraciones (card Meta Ads), página Métricas Meta Ads en el menú y en Studio IA.

---

## Paso 1: Verificar tu usuario en Skalemotors

1. Entra a la app con un usuario que tenga **sucursal asignada** (`branch_id`).
2. Si tu usuario no tiene sucursal: en **Configuración** o **Usuarios** (como admin) asígnale una sucursal. Sin sucursal no se puede conectar Meta Ads.

---

## Paso 2: Crear o usar una app en Meta for Developers

1. Entra a **https://developers.facebook.com** e inicia sesión.
2. Ve a **Mis aplicaciones** → **Crear aplicación** (o elige una existente).
3. Si creas una nueva:
   - Tipo: **Empresa** (o la que permita Marketing API).
   - Nombre: por ejemplo "Skalemotors" o "Mi Automotora".
4. En el panel de la app, en **Configuración → Básica** anota:
   - **ID de la aplicación** (App ID).
   - **Clave secreta de la aplicación** (App Secret) — no la compartas ni la pongas en el frontend.

---

## Paso 3: Añadir producto Marketing API y permisos

1. En la misma app, ve a **Panel de la aplicación** (o **Productos**).
2. Busca **Marketing API** y haz clic en **Configurar** / **Añadir producto**.
3. Asegúrate de tener también **Facebook Login** (o **Inicio de sesión con Facebook**) si vas a usar el flujo de login más adelante. Para el método con token manual no es obligatorio.
4. Ve a **Facebook Login → Configuración** (o **Permisos y características**).
5. En **Permisos de la aplicación** añade:
   - `ads_management`
   - `ads_read`
   - `business_management`
6. Guarda los cambios.

---

## Paso 4: Obtener un token de acceso con permisos de Ads

Tienes dos formas; con una basta.

### Opción A: Graph API Explorer (rápida para pruebas)

1. Entra a **https://developers.facebook.com/tools/explorer/**.
2. Arriba a la derecha, selecciona **tu app** en "Meta App".
3. Haz clic en **Generar token de acceso** (o "User Token").
4. En la ventana de permisos, marca al menos:
   - **ads_management**
   - **ads_read**
   - **business_management**
5. Inicia sesión si te lo pide y acepta. Copia el **token** (empieza por `EAA...`).
6. Este token puede caducar en unas horas o días. Para uso prolongado conviene usar Opción B o un token de larga duración.

### Opción B: Token de larga duración (recomendado para uso real)

1. En **Graph API Explorer** genera un token como en la Opción A (token de usuario a corto plazo).
2. Luego en el navegador abre (sustituye `APP_ID`, `APP_SECRET` y `SHORT_LIVED_TOKEN` por tus valores):

   ```
   https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN
   ```

3. La respuesta incluye `access_token` y `expires_in` (suele ser ~60 días). Usa ese `access_token` en Skalemotors.

---

## Paso 5: (Opcional) Saber tu ID de cuenta de anuncios

Si quieres fijar una cuenta de anuncios concreta:

1. En **Graph API Explorer**, con el mismo token, en "Endpoint" pon: `me/adaccounts` y ejecuta **Enviar**.
2. En la respuesta verás algo como `"id": "act_1234567890"`. Ese es tu **Ad Account ID**.
3. En Skalemotors puedes pegar `act_1234567890` en el campo opcional "ID cuenta de anuncios". Si no lo pones, la app usará la primera cuenta a la que tenga acceso el token.

---

## Paso 6: Conectar Meta Ads en Skalemotors

1. En la app, entra con un usuario que tenga sucursal.
2. Ve al menú lateral → **Sistema** → **Integraciones** (o **Configuración** → Integraciones, según tu menú).
3. Localiza la tarjeta **Meta (Facebook/Instagram) Ads**.
4. Haz clic en **Conectar**.
5. En el modal:
   - **Token de acceso**: pega el token que generaste (el que empieza por `EAA...`).
   - **ID cuenta de anuncios** (opcional): si lo sabes, pega `act_XXXX`.
6. Haz clic en **Conectar**.
7. Si todo va bien verás "Conectado" y podrás usar **Desconectar** o **Ver campañas y métricas**.

Si sale error, revisa que el token tenga los permisos `ads_read` y `ads_management` y que la app en Meta tenga el producto Marketing API.

---

## Paso 7: Ver las métricas en la app

1. En el menú lateral ve a **Analytics & Herramientas** → **Métricas Meta Ads**  
   (o **Studio IA** → Marketing → Facebook Ads, según cómo esté tu menú).
2. Deberías ver:
   - **Campañas**: lista de campañas de la cuenta (nombre, estado, objetivo, presupuesto, fechas).
   - **Analytics**: alcance, impresiones, clics, gasto, CTR, CPC y un gráfico en el tiempo (según el período elegido).
3. Si ves "Conecta tu cuenta de Meta Ads": vuelve a **Integraciones** y conecta con el token del Paso 6.
4. Si no tienes campañas en Meta, la tabla estará vacía; crea campañas en **Meta Ads Manager** (business.facebook.com/adsmanager) para ver datos.

---

## Resumen rápido

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| 1 | Skalemotors | Usuario con sucursal asignada |
| 2 | developers.facebook.com | Crear/usar app, anotar App ID y App Secret |
| 3 | Misma app | Añadir Marketing API y permisos ads_read, ads_management, business_management |
| 4 | Graph API Explorer | Generar token con esos permisos (corto o largo) |
| 5 | (Opcional) Graph API Explorer | `me/adaccounts` para obtener act_XXX |
| 6 | Skalemotors → Integraciones | Conectar: pegar token y opcionalmente act_XXX |
| 7 | Skalemotors → Métricas Meta Ads | Ver campañas y pestaña Analytics |

---

## Problemas frecuentes

- **"Meta Ads no conectado"**: Token sin permisos o expirado. Genera uno nuevo con `ads_read` y `ads_management` y vuelve a conectar.
- **"No se encontró ninguna cuenta de anuncios"**: El token no tiene acceso a cuentas de anuncios; revisa permisos y que la cuenta de Facebook/Meta esté asociada a una cuenta de anuncios en business.facebook.com.
- **Tabla de campañas vacía**: Crea al menos una campaña en Meta Ads Manager para que aparezca.
- **Error 401/403 al conectar**: Revisa que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en tu `.env` sean del mismo proyecto donde desplegaste las Edge Functions.
