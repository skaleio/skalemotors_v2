# Integración n8n para SKALE Motors

## 📋 Descripción General

Este módulo implementa la integración completa de n8n con SKALE Motors para automatizar:

- 🤖 Respuestas automáticas con IA en WhatsApp e Instagram
- 📊 Movimiento automático de leads en el CRM
- 👥 Asignación inteligente de vendedores
- 📱 Sincronización bidireccional de mensajes
- ⚡ Workflows personalizables por sucursal

## 🏗️ Arquitectura

### Multi-Tenancy

Cada sucursal (branch) tiene su propio workspace aislado en n8n:

```
SKALE Motors SaaS
├── Sucursal A → n8n Workspace A
│   ├── WhatsApp → CRM
│   ├── Instagram → CRM
│   ├── Agente IA
│   └── Automatizaciones
├── Sucursal B → n8n Workspace B
│   └── ... (mismo conjunto de workflows)
└── Sucursal N → n8n Workspace N
```

### Flujo de Datos

```
WhatsApp/Instagram → n8n Webhook → Supabase → SKALE Motors App
                          ↓
                     Agente IA (OpenAI)
                          ↓
                  Respuesta Automática
```

## 📁 Estructura de Archivos

```
SKALE MOTORS/
├── src/
│   ├── lib/
│   │   └── services/
│   │       └── n8n.ts                    # Servicio principal de n8n
│   ├── components/
│   │   ├── AIAgentBuilder.tsx            # Constructor de agente IA
│   │   └── AutomationRulesBuilder.tsx    # Constructor de reglas
│   └── pages/
│       └── AutomationSettings.tsx        # Página de configuración
├── scripts/
│   └── n8n_workspaces_setup.sql          # Schema de base de datos
├── docs/
│   ├── N8N_INTEGRATION_README.md         # Este archivo
│   ├── n8n_workflows_templates.md        # Templates de workflows
│   └── n8n_docker_setup.md               # Guía de instalación Docker
└── env.example.txt                        # Variables de entorno
```

## 🚀 Instalación

### 1. Base de Datos

Ejecuta el script SQL para crear las tablas necesarias:

```bash
psql -h tu-supabase-host -U postgres -d postgres -f scripts/n8n_workspaces_setup.sql
```

O desde Supabase Dashboard:
1. Ve a SQL Editor
2. Copia el contenido de `scripts/n8n_workspaces_setup.sql`
3. Ejecuta

### 2. n8n (Docker)

Sigue la guía completa en `docs/n8n_docker_setup.md`:

```bash
cd ~/n8n-skale-motors
docker-compose up -d
```

### 3. Variables de Entorno

Agrega a tu archivo `.env`:

```env
# n8n Configuration
VITE_N8N_URL=https://n8n.tudominio.com
VITE_N8N_API_KEY=tu_api_key_aqui
```

### 4. Workflows Base

Importa los workflows desde n8n:
1. Accede a tu instancia n8n
2. Ve a **Workflows** → **Import from File**
3. Importa cada workflow del directorio `workflows/`

## 🔧 Configuración

### Crear Workspace para una Sucursal

Desde la aplicación SKALE Motors:

1. Ve a **Automatizaciones** (`/app/automation`)
2. Click en **Crear Workspace de Automatización**
3. El sistema creará automáticamente:
   - Workspace en n8n
   - API key única
   - Webhooks configurados
   - Workflows base desplegados

### Configurar Agente IA

1. Ve a la pestaña **Agente IA**
2. Configura:
   - **Personalidad**: Formal, Casual o Técnico
   - **Horario**: Cuándo responder automáticamente
   - **FAQs**: Preguntas frecuentes
   - **Reglas de respuesta**: Triggers y respuestas
   - **Escalación**: Cuándo derivar a humano

### Configurar Automatizaciones

1. Ve a la pestaña **Automatizaciones**
2. Crea reglas con:
   - **Disparador**: Nuevo mensaje, lead inactivo, etc.
   - **Condiciones**: Palabras clave, tiempo, etc.
   - **Acciones**: Mover etapa, asignar vendedor, enviar mensaje

## 📊 Workflows Disponibles

### 1. WhatsApp → CRM

**Trigger:** Webhook de WhatsApp Business API

**Funcionalidad:**
- Recibe mensaje de WhatsApp
- Busca o crea lead en CRM
- Guarda mensaje en tabla `messages`
- Analiza con IA (opcional)
- Responde automáticamente si aplica

**Webhook URL:** `https://n8n.tudominio.com/webhook/{workspace_id}/whatsapp-to-crm`

### 2. Instagram → CRM

**Trigger:** Webhook de Instagram API

**Funcionalidad:** Similar a WhatsApp, adaptado para Instagram

### 3. Movimiento Automático de Leads

**Trigger:** INSERT en tabla `messages`

**Funcionalidad:**
- Cuenta interacciones del lead
- Analiza contenido del mensaje
- Detecta keywords (precio, comprar, test drive)
- Mueve lead a etapa correspondiente:
  - 0 mensajes → `nuevo`
  - 1 mensaje → `contactado`
  - 3+ mensajes → `calificado`
  - Menciona precio → `negociacion`
  - Confirma compra → `ganado`

### 4. Agente IA Responder

**Trigger:** Llamado desde workflow de WhatsApp

**Funcionalidad:**
- Verifica horario de respuesta
- Consulta base de conocimiento
- Genera respuesta con OpenAI GPT-4
- Detecta si requiere escalación
- Envía respuesta o notifica a vendedor

### 5. Asignación Automática de Leads

**Trigger:** INSERT en tabla `leads`

**Funcionalidad:**
- Obtiene vendedores disponibles
- Calcula carga de trabajo actual
- Asigna lead con algoritmo (round-robin o carga)
- Notifica al vendedor asignado

## 🔌 Integraciones

### WhatsApp Business API

**Configuración:**

1. Obtén credenciales de Meta Business
2. Configura webhook en Meta:
   - URL: `https://n8n.tudominio.com/webhook/{workspace_id}/whatsapp-to-crm`
   - Verify Token: (genera uno seguro)
3. Guarda el número en SKALE Motors → Automatizaciones → Conexiones

**Payload esperado:**

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "56912345678",
          "text": { "body": "Hola, quiero información" }
        }]
      }
    }]
  }]
}
```

### Instagram API

Similar a WhatsApp, requiere Facebook Business y aprobación de Meta.

### OpenAI API

Para el agente IA:

1. Obtén API key de OpenAI
2. Configura en n8n → Credentials → OpenAI
3. Modelo recomendado: `gpt-4-turbo` o `gpt-3.5-turbo`

## 🧪 Testing

### Probar Webhook de WhatsApp

```bash
curl -X POST https://n8n.tudominio.com/webhook/test/whatsapp-to-crm \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "56912345678",
            "id": "wamid.test123",
            "timestamp": "1234567890",
            "type": "text",
            "text": { "body": "Hola, quiero información sobre un auto" }
          }]
        }
      }]
    }]
  }'
```

### Verificar en Supabase

```sql
-- Ver mensajes recibidos
SELECT * FROM messages 
WHERE contact_phone = '56912345678' 
ORDER BY sent_at DESC;

-- Ver leads creados
SELECT * FROM leads 
WHERE phone = '56912345678';

-- Ver ejecuciones de workflows
SELECT * FROM n8n_workflow_executions 
WHERE workflow_name = 'whatsapp-to-crm' 
ORDER BY started_at DESC 
LIMIT 10;
```

## 📈 Monitoreo

### Dashboard de n8n

Accede a `https://n8n.tudominio.com` para:
- Ver ejecuciones en tiempo real
- Revisar logs de errores
- Estadísticas de workflows
- Editar workflows visualmente

### Logs de Ejecución en SKALE Motors

```typescript
import N8nService from '@/lib/services/n8n';

// Obtener logs de ejecuciones
const executions = await N8nService.getWorkflowExecutions(
  workspaceId,
  {
    workflow_name: 'whatsapp-to-crm',
    status: 'error',
    limit: 50
  }
);
```

### Alertas

Configura alertas en n8n para:
- Workflows que fallan
- Tiempo de ejecución excesivo
- Errores de API (WhatsApp, OpenAI)

## 🔒 Seguridad

### Row Level Security (RLS)

Las tablas `n8n_workspaces` y `n8n_workflow_executions` tienen RLS activado:

- Los usuarios solo ven configuración de su sucursal
- Solo admins y gerentes pueden modificar configuración
- Los webhooks validan firma HMAC

### API Keys

- Cada workspace tiene su propia API key
- Las keys se almacenan encriptadas en Supabase
- Rotar keys periódicamente

### Webhooks

Valida siempre la firma de webhooks:

```typescript
const isValid = N8nService.validateWebhookSignature(
  payload,
  signature,
  secret
);
```

## 🐛 Troubleshooting

### Problema: Webhook no recibe mensajes

**Solución:**
1. Verifica que el workflow esté **activo** en n8n
2. Verifica la URL del webhook en WhatsApp Business
3. Revisa logs en n8n: `docker-compose logs -f n8n`
4. Prueba con curl (ver sección Testing)

### Problema: Agente IA no responde

**Solución:**
1. Verifica que `auto_response_enabled` esté en `true`
2. Verifica horario de respuesta configurado
3. Revisa API key de OpenAI en n8n
4. Revisa logs de ejecución del workflow `ai-agent-responder`

### Problema: Leads no se mueven automáticamente

**Solución:**
1. Verifica que el workflow `lead-stage-automation` esté activo
2. Verifica que el trigger de base de datos esté configurado
3. Revisa las reglas de movimiento en el workflow
4. Verifica permisos de Supabase

### Problema: Error de conexión a Supabase

**Solución:**
1. Verifica credenciales de Supabase en n8n
2. Usa Service Role Key, no Anon Key
3. Verifica que RLS permita operaciones desde n8n
4. Revisa firewall/IP whitelist en Supabase

## 📚 Recursos

- [Documentación n8n](https://docs.n8n.io/)
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Supabase Docs](https://supabase.com/docs)

## 🤝 Contribuir

Para agregar nuevos workflows:

1. Crea el workflow en n8n
2. Exporta como JSON
3. Documenta en `docs/n8n_workflows_templates.md`
4. Agrega tests

## 📝 Changelog

### v1.0.0 (2026-01-22)

- ✅ Integración inicial de n8n
- ✅ Workflows base (WhatsApp, Instagram, Lead automation)
- ✅ Agente IA con OpenAI
- ✅ UI de configuración en SKALE Motors
- ✅ Multi-tenancy por sucursal
- ✅ Documentación completa

## 📄 Licencia

Uso interno de SKALE Motors. Todos los derechos reservados.

## 👥 Soporte

Para soporte técnico:
- Email: soporte@skalemotors.com
- Slack: #n8n-automation
- Documentación: `/docs`
