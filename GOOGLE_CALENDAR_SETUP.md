# Configuración de Google Calendar API

Esta guía te ayudará a configurar la integración con Google Calendar para la aplicación SKALE Motors.

## ⚡ Inicio Rápido

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto nuevo
3. Habilita Google Calendar API
4. Crea credenciales OAuth 2.0 y API Key
5. Agrega las credenciales al archivo `.env`
6. Reinicia el servidor de desarrollo

## Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el **Project ID**

## Paso 2: Habilitar Google Calendar API

1. En el menú lateral, ve a **APIs & Services** > **Library**
2. Busca "Google Calendar API"
3. Haz clic en **Enable**

## Paso 3: Crear Credenciales OAuth 2.0

1. Ve a **APIs & Services** > **Credentials**
2. Haz clic en **Create Credentials** > **OAuth client ID**
3. Si es la primera vez, configura la **OAuth consent screen**:
   - User Type: **External**
   - App name: **SKALE Motors**
   - User support email: Tu email
   - Developer contact: Tu email
   - Scopes: Agregar **Google Calendar API** (`.../auth/calendar.events`)
   - Test users: Agrega los emails que probarán la app

4. Crear OAuth client ID:
   - Application type: **Web application**
   - Name: **SKALE Motors Calendar**
   - Authorized JavaScript origins:
     - `http://localhost:5173` (desarrollo)
     - Tu dominio de producción
   - Authorized redirect URIs:
     - `http://localhost:5173` (desarrollo)
     - Tu dominio de producción

5. Descarga las credenciales y guarda:
   - **Client ID**: `XXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com`
   - **Client Secret**: `XXXXX-XXXXXXXXXXXXXXXXXXXXXXXX`

## Paso 4: Crear API Key

1. En **Credentials**, haz clic en **Create Credentials** > **API key**
2. Copia la API key generada
3. (Recomendado) Restringe la API key:
   - Application restrictions: **HTTP referrers**
   - Agrega: `localhost:5173/*` y tu dominio de producción
   - API restrictions: **Restrict key** > Selecciona **Google Calendar API**

## Paso 5: Configurar Variables de Entorno

Crea o actualiza el archivo `.env` en la raíz del proyecto:

```env
# Google Calendar API
VITE_GOOGLE_CLIENT_ID=TU_CLIENT_ID_AQUI.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=TU_API_KEY_AQUI
```

## Paso 6: Verificar Configuración

1. Reinicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Ve a la página de **Citas**

3. Haz clic en **Conectar Google Calendar**

4. Autoriza la aplicación con tu cuenta de Google

5. Una vez conectado, podrás:
   - Ver tus eventos de Google Calendar en el calendario
   - Crear eventos que se sincronicen con Google Calendar
   - Editar y eliminar eventos sincronizados

## Solución de Problemas

### Error: "Invalid client ID"
- Verifica que el CLIENT_ID en `.env` sea correcto
- Asegúrate de incluir el dominio completo (`.apps.googleusercontent.com`)

### Error: "Origin not allowed"
- Verifica que hayas agregado `http://localhost:5173` en **Authorized JavaScript origins**
- Espera unos minutos para que los cambios se propaguen

### Error: "Access blocked: This app's request is invalid"
- Completa la **OAuth consent screen**
- Agrega tu email como usuario de prueba
- Verifica que hayas habilitado los scopes correctos

### Error: "The API key doesn't have sufficient permissions"
- Asegúrate de haber habilitado Google Calendar API
- Verifica las restricciones de la API key

## Funcionalidades Disponibles

Una vez configurado, tendrás acceso a:

✅ **Sincronización bidireccional**: Los eventos creados en SKALE Motors aparecen en Google Calendar y viceversa

✅ **Crear eventos**: Crea citas que automáticamente se agregan a tu Google Calendar

✅ **Editar eventos**: Modifica eventos y los cambios se reflejan en ambos calendarios

✅ **Eliminar eventos**: Borra eventos de forma sincronizada

✅ **Ver eventos**: Visualiza todos tus eventos de Google Calendar en la interfaz de SKALE Motors

✅ **Recordatorios**: Los eventos incluyen recordatorios automáticos (email 24h antes, popup 30min antes)

## Limitaciones de la API Gratuita

- **Cuota diaria**: 1,000,000 de solicitudes/día
- **Solicitudes por segundo**: 10 por usuario

Para la mayoría de automotoras, estos límites son más que suficientes.

## Recursos Adicionales

- [Documentación oficial de Google Calendar API](https://developers.google.com/calendar/api/v3/reference)
- [Guía de OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)

## Soporte

Si tienes problemas con la configuración, contacta al equipo de desarrollo o consulta la documentación oficial de Google.
