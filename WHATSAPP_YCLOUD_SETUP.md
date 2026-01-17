# WhatsApp Business (YCloud) → Centro de Mensajes (por teléfono)

Esta guía conecta tu número de **WhatsApp Business** (gestionado por **YCloud**) al **Centro de Mensajes** (`/app/messages`) para ver el chat **por teléfono** (con estilo “chat”).

## 1) Base de datos (Supabase)

Ejecuta en **Supabase Dashboard → SQL Editor**:

- `scripts/whatsapp_ycloud_messages_setup.sql`

Qué hace:
- Crea `public.whatsapp_inboxes` (para mapear tu número / phone_number_id del proveedor a una sucursal).
- Extiende `public.messages` con:
  - `contact_phone` (clave para agrupar conversaciones)
  - `inbox_id`, `branch_id` (seguridad por sucursal)
  - `provider_message_id` / `raw_payload` (deduplicación + auditoría)
- Agrega índices y RLS mínimo.

### Registrar tu inbox (OBLIGATORIO)

Inserta una fila en `public.whatsapp_inboxes` con tu `provider_phone_number_id` de YCloud y la sucursal.

Ejemplo:

```sql
insert into public.whatsapp_inboxes (provider, provider_phone_number_id, display_number, branch_id)
values ('ycloud', 'TU_PROVIDER_PHONE_NUMBER_ID', '+56XXXXXXXXX', '550e8400-e29b-41d4-a716-446655440000');
```

## 2) Edge Functions (Supabase)

En el repo se agregaron estas funciones:
- `supabase/functions/ycloud-webhook` → recibe webhooks de YCloud y guarda en `public.messages`
- `supabase/functions/whatsapp-send` → el frontend la llama para **enviar** WhatsApp (proxy seguro) y guardar el mensaje saliente

### Variables de entorno (Supabase Functions)

Configúralas en Supabase (Functions → Secrets) o por CLI:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Webhook:
- `YCLOUD_WEBHOOK_TOKEN` (recomendado): token simple para validar el webhook.

Envío YCloud (ajustable según tu cuenta):
- `YCLOUD_API_BASE` (default: `https://api.ycloud.com`)
- `YCLOUD_SEND_PATH` (default: `/v2/whatsapp/messages`)
- `YCLOUD_AUTH_HEADER` (default: `X-API-Key`)
- `YCLOUD_AUTH_VALUE` (o `YCLOUD_API_KEY`)
- `YCLOUD_WHATSAPP_FROM` (según YCloud: sender / phone_number_id / etc.)

## 3) Configurar webhook en YCloud

En YCloud configura el webhook apuntando a tu función:

- URL: `https://TU-PROYECTO.supabase.co/functions/v1/ycloud-webhook?token=TU_TOKEN`

O usa header `x-webhook-token: TU_TOKEN`.

Importante:
- Asegúrate de que el payload incluya algún identificador de “línea” (phone_number_id / metadata) para que la función pueda mapear `branch_id` vía `whatsapp_inboxes`.

## 4) Frontend (ya conectado)

La pantalla `src/pages/Messages.tsx` ahora:
- Lee `public.messages` con `type='whatsapp'`
- Agrupa conversaciones por `contact_phone`
- Muestra el chat y envía mensajes usando `supabase.functions.invoke('whatsapp-send')`
- Se suscribe a cambios (Realtime) para actualizar sin refrescar

## 5) Notas prácticas / siguientes mejoras

- **“Leído”**: hoy se refleja cuando llegue el status desde el proveedor. Si quieres “marcar como leído al abrir”, se puede agregar un update controlado (idealmente desde una Edge Function).
- **Adjuntos** (audio/imágenes): el webhook ya guarda `raw_payload`; se puede extender el UI para renderizar tipos.
- **Multi-sucursal**: queda resuelto por `branch_id` + RLS, siempre que el inbox esté registrado.


