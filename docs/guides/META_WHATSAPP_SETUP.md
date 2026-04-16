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

## 4) Configurar `whatsapp_inboxes` en Supabase

1. Ejecuta la migración:
   - `supabase/migrations/20260320120000_meta_whatsapp_provider_default.sql`
2. Registra un inbox para tu sucursal:
   - `provider = 'meta'`
   - `provider_phone_number_id = META_PHONE_NUMBER_ID`
   - `branch_id = <tu-branch_uuid>`
   - `display_number` (opcional)
3. Con esto, `supabase/functions/whatsapp-send` podrá resolver automáticamente el `inbox_id`.

## 5) Notas

- Por ahora, la pantalla de **llamadas de voz** no está soportada con Meta (solo mensajería por texto).
- Los webhooks de Meta validan firma con `X-Hub-Signature-256` usando `META_APP_SECRET`.

