# Templates de Workflows n8n para SKALE Motors

Este documento describe los workflows base que deben ser configurados en n8n para cada sucursal.

## Workflow 1: WhatsApp → Mensajería + CRM

**Nombre:** `whatsapp-to-crm`

**Trigger:** Webhook - Recibe mensaje de WhatsApp Business API

**Flujo:**

```
1. Webhook Trigger
   ↓
2. Extract Data (Function Node)
   - Parsear número de teléfono
   - Extraer nombre del contacto
   - Obtener contenido del mensaje
   - Timestamp
   ↓
3. Check Lead Exists (Supabase Node)
   - Query: SELECT * FROM leads WHERE phone = {{$json.phone}} AND branch_id = {{$json.branch_id}}
   ↓
4. Branch Logic (IF Node)
   ├─ Lead Exists → Update Lead
   │  - UPDATE leads SET last_contact_at = NOW(), notes = CONCAT(notes, '\n', {{message}})
   │  - WHERE id = {{lead_id}}
   │
   └─ Lead Not Exists → Create Lead
      - INSERT INTO leads (phone, full_name, source, status, branch_id)
      - VALUES ({{phone}}, {{name}}, 'whatsapp', 'nuevo', {{branch_id}})
   ↓
5. Insert Message (Supabase Node)
   - INSERT INTO messages (contact_phone, contact_name, content, direction, status, type, branch_id)
   - VALUES ({{phone}}, {{name}}, {{content}}, 'entrante', 'entregado', 'whatsapp', {{branch_id}})
   ↓
6. AI Analysis (OpenAI Node) - OPCIONAL
   - Analizar sentimiento del mensaje
   - Detectar intención (consulta, queja, compra)
   - Clasificar urgencia (alta, media, baja)
   ↓
7. Auto Response Decision (IF Node)
   - Si horario laboral Y keyword match → Responder
   - Si fuera de horario → Mensaje automático
   - Si keyword de escalación → Notificar gerente
   ↓
8. Send WhatsApp Response (HTTP Request Node)
   - POST a WhatsApp Business API
   - Body: { to: {{phone}}, text: {{response_template}} }
```

**Variables de Configuración:**

```json
{
  "branch_id": "uuid-sucursal",
  "webhook_url": "https://n8n.tudominio.com/webhook/whatsapp-to-crm",
  "whatsapp_api_url": "https://api.whatsapp.com/send",
  "supabase_url": "{{$env.SUPABASE_URL}}",
  "supabase_key": "{{$env.SUPABASE_KEY}}",
  "openai_api_key": "{{$env.OPENAI_API_KEY}}"
}
```

---

## Workflow 2: Instagram → CRM

**Nombre:** `instagram-to-crm`

**Trigger:** Webhook - Recibe mensaje de Instagram API

**Flujo:** Similar a WhatsApp, adaptado para Instagram

```
1. Webhook Trigger (Instagram)
2. Extract Instagram Data
3. Check Lead Exists (by instagram_handle)
4. Create/Update Lead
5. Insert Message
6. AI Analysis
7. Auto Response (Instagram API)
```

---

## Workflow 3: Movimiento Automático de Leads

**Nombre:** `lead-stage-automation`

**Trigger:** Database Change - Tabla `messages`

**Flujo:**

```
1. Database Trigger (Supabase)
   - ON INSERT messages
   ↓
2. Get Lead Info (Supabase Node)
   - SELECT * FROM leads WHERE phone = {{$json.contact_phone}}
   ↓
3. Count Interactions (Supabase Node)
   - SELECT COUNT(*) FROM messages WHERE contact_phone = {{phone}}
   ↓
4. Analyze Message Content (Function Node)
   - Detectar keywords: precio, test drive, comprar, financiamiento
   - Calcular score de interés (0-100)
   ↓
5. Determine New Stage (Switch Node)
   ├─ 0 mensajes → 'nuevo'
   ├─ 1 mensaje → 'contactado'
   ├─ 3+ mensajes → 'calificado'
   ├─ Menciona precio → 'negociacion'
   └─ Confirma compra → 'ganado'
   ↓
6. Update Lead Status (Supabase Node)
   - UPDATE leads SET status = {{new_status}}, updated_at = NOW()
   ↓
7. Create Activity Log (Supabase Node)
   - INSERT INTO lead_activities (lead_id, type, description)
   - VALUES ({{lead_id}}, 'status_change', 'Movido a {{new_status}} automáticamente')
   ↓
8. Notify Assigned User (Optional)
   - Send notification to assigned salesperson
```

**Reglas de Movimiento:**

```javascript
// Function Node: Determine Stage
const messageCount = $input.first().json.message_count;
const content = $input.first().json.content.toLowerCase();

// Keywords de interés
const priceKeywords = ['precio', 'cuánto cuesta', 'valor', 'cuota'];
const buyKeywords = ['comprar', 'adquirir', 'reservar', 'apartar'];
const testDriveKeywords = ['test drive', 'probar', 'ver el auto'];

let newStage = 'nuevo';
let interestScore = 0;

// Calcular score
if (messageCount >= 1) {
  newStage = 'contactado';
  interestScore = 20;
}

if (messageCount >= 3) {
  newStage = 'calificado';
  interestScore = 40;
}

if (priceKeywords.some(kw => content.includes(kw))) {
  newStage = 'negociacion';
  interestScore = 60;
}

if (testDriveKeywords.some(kw => content.includes(kw))) {
  interestScore += 20;
}

if (buyKeywords.some(kw => content.includes(kw))) {
  newStage = 'ganado';
  interestScore = 100;
}

return {
  json: {
    new_stage: newStage,
    interest_score: interestScore,
    lead_id: $input.first().json.lead_id
  }
};
```

---

## Workflow 4: Agente IA Responder

**Nombre:** `ai-agent-responder`

**Trigger:** Webhook - Llamado desde `whatsapp-to-crm`

**Flujo:**

```
1. Webhook Trigger
   - Recibe: { phone, message, lead_id, branch_id }
   ↓
2. Get Branch Config (Supabase Node)
   - SELECT ai_agent_config FROM n8n_workspaces WHERE branch_id = {{branch_id}}
   ↓
3. Check Response Hours (Function Node)
   - Verificar si está dentro del horario configurado
   - Si fuera de horario → Respuesta automática simple
   ↓
4. Get Knowledge Base (Supabase Node)
   - SELECT * FROM vehicles WHERE branch_id = {{branch_id}} AND is_active = true
   - SELECT faqs FROM ai_agent_config
   ↓
5. Build AI Context (Function Node)
   - Construir prompt con:
     - Personalidad del agente
     - Catálogo de vehículos
     - FAQs
     - Historial de conversación
   ↓
6. Call OpenAI (OpenAI Node)
   - Model: gpt-4-turbo
   - System prompt: {{personality_prompt}}
   - User message: {{customer_message}}
   - Context: {{knowledge_base}}
   ↓
7. Check Escalation (Function Node)
   - Si AI detecta keywords de escalación → requires_human = true
   - Si pregunta muy específica → requires_human = true
   ↓
8. Branch Response (IF Node)
   ├─ Requires Human → Notify Sales Team
   │  - INSERT INTO tasks (assigned_to, lead_id, description)
   │  - Send notification
   │
   └─ Auto Response → Send Message
      - POST to WhatsApp API
      - Log response in messages table
```

**Prompt del Agente IA:**

```
Eres {{agent_name}}, asistente virtual de {{branch_name}}, una automotora especializada en venta de vehículos.

Personalidad: {{personality}}
- formal: Profesional, cortés, usa usted
- casual: Amigable, cercano, usa tú
- tecnico: Detallado, enfocado en especificaciones

Tu objetivo es:
1. Responder consultas sobre vehículos disponibles
2. Agendar test drives
3. Proporcionar información de precios (rangos generales)
4. Derivar a un asesor humano cuando sea necesario

Catálogo disponible:
{{vehicle_catalog}}

FAQs:
{{faqs}}

Reglas:
- Siempre sé amable y profesional
- Si no sabes algo, di que consultarás con un asesor
- No inventes precios exactos, da rangos
- Si detectas una queja o problema, escala inmediatamente
- Máximo 2 mensajes antes de ofrecer contacto con asesor humano

Historial de conversación:
{{conversation_history}}

Mensaje del cliente: {{customer_message}}

Responde de manera natural y útil:
```

---

## Workflow 5: Asignación Automática de Leads

**Nombre:** `lead-auto-assignment`

**Trigger:** Database Change - Tabla `leads` (INSERT)

**Flujo:**

```
1. Database Trigger
   - ON INSERT leads
   ↓
2. Get Available Salespeople (Supabase Node)
   - SELECT * FROM users 
   - WHERE branch_id = {{branch_id}} 
   - AND role = 'vendedor' 
   - AND is_active = true
   ↓
3. Get Current Workload (Supabase Node)
   - SELECT assigned_to, COUNT(*) as lead_count
   - FROM leads
   - WHERE status NOT IN ('ganado', 'perdido')
   - GROUP BY assigned_to
   ↓
4. Calculate Assignment (Function Node)
   - Algoritmo: Round-robin o por carga
   - Considerar: leads activos, tasa de conversión, disponibilidad
   ↓
5. Assign Lead (Supabase Node)
   - UPDATE leads SET assigned_to = {{selected_user_id}}
   - WHERE id = {{lead_id}}
   ↓
6. Create Activity (Supabase Node)
   - INSERT INTO lead_activities
   - (lead_id, type, description, user_id)
   ↓
7. Notify Salesperson
   - Email, SMS, o notificación in-app
   - "Nuevo lead asignado: {{lead_name}}"
```

---

## Configuración de Webhooks en WhatsApp Business API

Para recibir mensajes en n8n:

1. **Configurar Webhook URL en WhatsApp:**
   - URL: `https://n8n.tudominio.com/webhook/{{workspace_id}}/whatsapp-to-crm`
   - Verify Token: `{{random_secure_token}}`

2. **Payload esperado:**

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "phone_number_id": "123456789"
        },
        "messages": [{
          "from": "56912345678",
          "id": "wamid.xxx",
          "timestamp": "1234567890",
          "type": "text",
          "text": {
            "body": "Hola, quiero información"
          }
        }]
      }
    }]
  }]
}
```

3. **Validación de Webhook:**

```javascript
// Function Node: Validate Webhook
const signature = $request.headers['x-hub-signature-256'];
const payload = JSON.stringify($request.body);
const secret = $env.WHATSAPP_WEBHOOK_SECRET;

// Validar HMAC SHA256
const crypto = require('crypto');
const expectedSignature = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}

return { json: $request.body };
```

---

## Docker Compose para n8n Self-Hosted

Archivo `docker-compose.yml` para desplegar n8n:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n-skale-motors
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=false
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=${POSTGRES_USER}
      - DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://${N8N_HOST}/
      - GENERIC_TIMEZONE=America/Santiago
    volumes:
      - n8n_data:/home/node/.n8n
      - ./n8n-backups:/backups
    depends_on:
      - postgres
    networks:
      - n8n-network

  postgres:
    image: postgres:15-alpine
    container_name: n8n-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=n8n
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - n8n-network

volumes:
  n8n_data:
  postgres_data:

networks:
  n8n-network:
    driver: bridge
```

**.env para Docker:**

```env
N8N_ENCRYPTION_KEY=tu_clave_encriptacion_segura_aqui
POSTGRES_USER=n8n_user
POSTGRES_PASSWORD=tu_password_seguro_aqui
N8N_HOST=n8n.tudominio.com
```

---

## Próximos Pasos

1. Desplegar n8n usando Docker Compose
2. Importar workflows base desde JSON
3. Configurar credenciales (Supabase, WhatsApp, OpenAI)
4. Probar cada workflow con datos de prueba
5. Configurar webhooks en WhatsApp Business API
6. Monitorear logs de ejecución
