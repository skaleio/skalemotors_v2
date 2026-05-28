# WhatsApp Business API (Meta) - Setup

Guía para configurar la integración oficial de WhatsApp Business Cloud API usando **Meta Graph API** y nuestros Edge Functions de Supabase:

- `supabase/functions/whatsapp-send` (envía mensajes)
- `supabase/functions/meta-webhook` (webhook de mensajes y estados: entregado / leído)

## 1) Requisitos en Meta (manual)

1. Crear / usar un **Meta Business Suite**.
2. En [Meta for Developers](https://developers.facebook.com/), crea una **App** y agrega el producto **WhatsApp**.
3. Conecta o crea un **WhatsApp Business Account (WABA)** y registra el **número de teléfono**.
4. Crea un **System User** (System User token) con permisos para mensajería WhatsApp.
5. Obtén:
   - `META_ACCESS_TOKEN` (token del System User)
   - `META_PHONE_NUMBER_ID` (ID del número de teléfono dentro del WABA)
   - `META_APP_SECRET` (App Secret)

## 2) Variables de entorno (Supabase Secrets)

Configura en Supabase (Edge Functions → Secrets) las variables indicadas en `.env.example` (sección Edge Functions / Meta):

- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID` (o asegúrate de que exista `whatsapp_inboxes.provider_phone_number_id`)
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN` (token para la verificación inicial del webhook)

Además, para el flujo hacia n8n:
- `N8N_MESSAGE_WEBHOOK_URL`
- `N8N_MESSAGE_WEBHOOK_TOKEN` (si tu endpoint lo requiere)

## 3) Configurar el webhook en Meta

1. En el panel de WhatsApp de Meta, ve a **Webhooks**.
2. Usa esta URL:
   - `https://<TU-PROYECTO-SUPABASE>.supabase.co/functions/v1/meta-webhook`
3. Verifica con:
   - `Verify Token = META_WEBHOOK_VERIFY_TOKEN`
4. Suscríbete a los eventos:
   - `messages`
   - `message_deliveries`
   - `message_reads`

## 4) Conectar por automotora (SaaS)

Cada sucursal conecta su propio número desde la app:

1. Aplica migraciones (incluye `20260522143000_whatsapp_saas_inbox_credentials.sql`).
2. En **Integraciones → WhatsApp Business (Meta)** ingresa:
   - Token de acceso (System User con permisos WhatsApp)
   - Phone Number ID (desde WhatsApp Manager)
   - WABA ID (opcional)
3. Edge Functions:
   - `whatsapp-connect` / `whatsapp-disconnect` / `whatsapp-status`
   - `whatsapp-send` usa el token guardado por sucursal (tabla `whatsapp_inbox_credentials`).

**Piloto legacy (un solo número global):** solo si `WHATSAPP_LEGACY_GLOBAL_FALLBACK=true` en secrets y `META_ACCESS_TOKEN` + `META_PHONE_NUMBER_ID`. No usar en producción multi-tenant.

## 5) Notas

- Por ahora, la pantalla de **llamadas de voz** no está soportada con Meta (solo mensajería por texto).
- Los webhooks de Meta validan firma con `X-Hub-Signature-256` usando `META_APP_SECRET`.
- Próximo paso producto: **Meta Embedded Signup** (OAuth embebido) en lugar de pegar token manualmente.

