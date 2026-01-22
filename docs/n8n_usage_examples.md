# Ejemplos de Uso - Integración n8n SKALE Motors

Este documento proporciona ejemplos prácticos de cómo usar la integración n8n en SKALE Motors.

## 📱 Caso de Uso 1: Cliente Nuevo por WhatsApp

### Escenario

Un cliente potencial envía su primer mensaje por WhatsApp preguntando por un vehículo.

### Flujo Automático

```
1. Cliente: "Hola, quiero información sobre el Toyota Corolla 2024"
   ↓
2. n8n recibe webhook de WhatsApp
   ↓
3. Verifica si el cliente existe en CRM
   ↓
4. No existe → Crea nuevo lead:
   - Nombre: (extraído de WhatsApp)
   - Teléfono: +56912345678
   - Fuente: whatsapp
   - Estado: nuevo
   ↓
5. Guarda mensaje en tabla messages
   ↓
6. Agente IA analiza el mensaje:
   - Detecta interés en modelo específico
   - Detecta intención de compra: media
   ↓
7. Genera respuesta automática:
   "¡Hola! Gracias por tu interés en el Toyota Corolla 2024. 
   Es un excelente vehículo. ¿Te gustaría agendar un test drive 
   o recibir más información sobre sus características?"
   ↓
8. Envía respuesta por WhatsApp
   ↓
9. Asigna lead automáticamente a vendedor disponible
   ↓
10. Notifica al vendedor asignado
```

### Código de Ejemplo

```typescript
// En tu componente React
import N8nService from '@/lib/services/n8n';

// Ejecutar workflow manualmente si es necesario
const handleManualTrigger = async () => {
  const execution = await N8nService.executeWorkflow(
    workspaceId,
    'whatsapp-to-crm',
    {
      phone: '+56912345678',
      message: 'Hola, quiero información',
      branch_id: user.branch_id
    }
  );
  
  console.log('Workflow ejecutado:', execution.id);
};
```

## 🔄 Caso de Uso 2: Lead Caliente - Movimiento Automático

### Escenario

Un lead existente envía su tercer mensaje mencionando precio.

### Flujo Automático

```
1. Cliente: "¿Cuánto cuesta el Corolla? ¿Tienen financiamiento?"
   ↓
2. Workflow WhatsApp → CRM procesa mensaje
   ↓
3. Actualiza lead existente:
   - last_contact_at: NOW()
   - Agrega nota con el mensaje
   ↓
4. Guarda mensaje en tabla messages
   ↓
5. Trigger de base de datos activa workflow "lead-stage-automation"
   ↓
6. Cuenta interacciones: 3 mensajes
   ↓
7. Analiza contenido:
   - Detecta keyword "precio" → Alta intención
   - Detecta keyword "financiamiento" → Interés serio
   ↓
8. Calcula nuevo estado:
   - Mensajes >= 3 → "calificado"
   - Menciona precio → "negociacion"
   ↓
9. Actualiza lead:
   - status: "negociacion"
   - interest_score: 75
   ↓
10. Crea actividad en CRM:
    "Lead movido a negociación automáticamente por mencionar precio"
   ↓
11. Notifica al vendedor asignado:
    "🔥 Lead caliente: Juan Pérez preguntó por precio"
```

### Configurar Regla Personalizada

```typescript
// En AutomationSettings
const customRule: AutomationRule = {
  id: 'rule_price_mention',
  name: 'Mover a negociación cuando menciona precio',
  enabled: true,
  trigger: {
    type: 'new_message',
    conditions: {
      contains: 'precio,cuánto cuesta,valor,cuota,financiamiento'
    }
  },
  actions: [
    {
      type: 'move_lead_stage',
      params: {
        stage: 'negociacion'
      }
    },
    {
      type: 'send_message',
      params: {
        message: 'Perfecto! Un asesor se pondrá en contacto contigo pronto para darte toda la información de precios y financiamiento.'
      }
    }
  ]
};

// Guardar regla
await N8nService.updateAutomationRules(workspaceId, [
  ...existingRules,
  customRule
]);
```

## 🤖 Caso de Uso 3: Configurar Agente IA Personalizado

### Escenario

Quieres que el agente IA responda con personalidad casual y solo en horario laboral.

### Configuración

```typescript
import type { AIAgentConfig } from '@/lib/services/n8n';

const aiConfig: AIAgentConfig = {
  name: 'Sofía',
  personality: 'casual',
  language: 'es-CL',
  auto_response_enabled: true,
  
  // Solo responder de 9 AM a 6 PM
  response_hours: {
    start: '09:00',
    end: '18:00'
  },
  
  // Base de conocimiento
  knowledge_base: {
    faqs: [
      {
        question: '¿Cuál es el horario de atención?',
        answer: 'Estamos de lunes a viernes de 9:00 a 18:00 hrs, y sábados de 10:00 a 14:00 hrs.'
      },
      {
        question: '¿Dónde están ubicados?',
        answer: 'Nos encontramos en Av. Providencia 1234, Santiago. ¡Te esperamos!'
      },
      {
        question: '¿Aceptan permutas?',
        answer: 'Sí, aceptamos tu auto usado como parte de pago. Podemos tasarlo sin compromiso.'
      }
    ],
    vehicle_catalog_enabled: true,
    price_ranges_enabled: false // No dar precios exactos
  },
  
  // Respuestas automáticas
  auto_response_rules: [
    {
      trigger: 'hola|buenos días|buenas tardes|buenas noches',
      response_template: '¡Hola! Soy Sofía 👋 ¿En qué puedo ayudarte hoy?',
      requires_human: false
    },
    {
      trigger: 'test drive|probar|ver el auto',
      response_template: '¡Genial! Me encantaría coordinar un test drive para ti. ¿Qué día te viene mejor? Un asesor se pondrá en contacto contigo pronto.',
      requires_human: true
    },
    {
      trigger: 'precio|cuánto cuesta|valor',
      response_template: 'Con gusto te puedo ayudar con información de precios. Déjame conectarte con un asesor que te dará todos los detalles y opciones de financiamiento.',
      requires_human: true
    }
  ],
  
  // Escalación a humano
  escalation_rules: {
    keywords: [
      'gerente',
      'queja',
      'problema',
      'mal servicio',
      'cancelar',
      'devolver',
      'estafa',
      'abogado'
    ],
    inactive_hours: 24 // Si no responde en 24 hrs, notificar
  }
};

// Guardar configuración
await N8nService.updateAIAgentConfig(workspaceId, aiConfig);
```

### Resultado

```
Cliente (10:30 AM): "Hola"
Bot: "¡Hola! Soy Sofía 👋 ¿En qué puedo ayudarte hoy?"

Cliente: "Quiero ver el Corolla"
Bot: "¡Excelente elección! El Toyota Corolla es uno de nuestros modelos más populares. ¿Te gustaría agendar un test drive?"

Cliente: "Sí, y cuánto cuesta?"
Bot: "¡Genial! Me encantaría coordinar un test drive para ti. Con gusto te puedo ayudar con información de precios. Déjame conectarte con un asesor que te dará todos los detalles y opciones de financiamiento."

[Vendedor recibe notificación: "Lead caliente: Cliente quiere test drive y precio del Corolla"]
```

## 📊 Caso de Uso 4: Monitorear Ejecuciones

### Ver Logs de Workflows

```typescript
import N8nService from '@/lib/services/n8n';

// Obtener últimas 50 ejecuciones
const executions = await N8nService.getWorkflowExecutions(
  workspaceId,
  {
    limit: 50
  }
);

// Filtrar solo errores
const errors = await N8nService.getWorkflowExecutions(
  workspaceId,
  {
    status: 'error',
    limit: 20
  }
);

// Filtrar por workflow específico
const whatsappExecutions = await N8nService.getWorkflowExecutions(
  workspaceId,
  {
    workflow_name: 'whatsapp-to-crm',
    limit: 100
  }
);

// Mostrar en UI
executions.forEach(exec => {
  console.log(`
    Workflow: ${exec.workflow_name}
    Estado: ${exec.status}
    Tiempo: ${exec.execution_time_ms}ms
    Inicio: ${new Date(exec.started_at).toLocaleString()}
  `);
});
```

### Componente de Monitoreo

```typescript
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import N8nService from '@/lib/services/n8n';

export function WorkflowMonitor({ workspaceId }: { workspaceId: string }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutions();
    // Actualizar cada 30 segundos
    const interval = setInterval(loadExecutions, 30000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const loadExecutions = async () => {
    try {
      const data = await N8nService.getWorkflowExecutions(workspaceId, {
        limit: 20
      });
      setExecutions(data);
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'success',
      error: 'destructive',
      running: 'default',
      waiting: 'secondary'
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Ejecuciones Recientes</h3>
      <div className="space-y-2">
        {executions.map((exec) => (
          <div key={exec.id} className="flex items-center justify-between p-2 border rounded">
            <div>
              <p className="font-medium">{exec.workflow_name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(exec.started_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{exec.execution_time_ms}ms</span>
              {getStatusBadge(exec.status)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

## 🔧 Caso de Uso 5: Crear Workflow Personalizado

### Escenario

Quieres enviar un mensaje automático a leads que no han respondido en 3 días.

### Configuración en n8n

1. **Crear nuevo workflow** en n8n
2. **Schedule Trigger**: Ejecutar diariamente a las 10 AM
3. **Supabase Query**:
```sql
SELECT l.*, u.full_name as assigned_name
FROM leads l
LEFT JOIN users u ON l.assigned_to = u.id
WHERE l.status IN ('nuevo', 'contactado')
  AND l.last_contact_at < NOW() - INTERVAL '3 days'
  AND l.branch_id = '{{$env.BRANCH_ID}}'
```
4. **Loop over items**
5. **Send WhatsApp Message**:
```
Hola {{$json.full_name}}, soy {{$json.assigned_name}} de SKALE Motors. 
Hace unos días nos consultaste sobre vehículos. 
¿Sigues interesado? ¿Hay algo en lo que pueda ayudarte?
```
6. **Update Lead**:
```sql
UPDATE leads 
SET last_contact_at = NOW(),
    notes = CONCAT(notes, '\n[', NOW(), '] Mensaje de seguimiento automático enviado')
WHERE id = '{{$json.id}}'
```

### Activar desde SKALE Motors

```typescript
// Crear regla de automatización
const followUpRule: AutomationRule = {
  id: 'rule_inactive_followup',
  name: 'Seguimiento a leads inactivos (3 días)',
  enabled: true,
  trigger: {
    type: 'schedule',
    conditions: {
      cron: '0 10 * * *' // Diario a las 10 AM
    }
  },
  actions: [
    {
      type: 'send_message',
      params: {
        message: 'Hola {{name}}, hace unos días nos consultaste sobre vehículos. ¿Sigues interesado?'
      }
    }
  ]
};
```

## 📈 Caso de Uso 6: Integración con Instagram

### Configurar Webhook de Instagram

1. **En Meta Business**:
   - Ve a tu app de Facebook
   - Configura webhook para Instagram
   - URL: `https://n8n.tudominio.com/webhook/{workspace_id}/instagram-to-crm`

2. **En SKALE Motors**:
```typescript
// Guardar cuenta de Instagram
await N8nService.updateWorkspace(workspaceId, {
  instagram_account: '@tuautomotora'
});
```

3. **Workflow en n8n** (similar a WhatsApp):
   - Webhook trigger para Instagram
   - Extraer datos del mensaje
   - Buscar/crear lead con `source: 'instagram'`
   - Guardar mensaje con `type: 'instagram'`
   - Responder con Instagram API

### Resultado

Los mensajes de Instagram aparecerán en la misma vista de Mensajes en SKALE Motors, diferenciados por el tipo.

## 🎯 Mejores Prácticas

### 1. Horarios de Respuesta

```typescript
// Configurar horarios diferentes para días de semana y fin de semana
const config = {
  response_hours: {
    weekday: { start: '09:00', end: '18:00' },
    weekend: { start: '10:00', end: '14:00' }
  }
};
```

### 2. Límite de Respuestas Automáticas

```typescript
// En el workflow, limitar a 2 respuestas automáticas antes de escalar
const autoResponseCount = await countAutoResponses(leadId);
if (autoResponseCount >= 2) {
  // Notificar a vendedor
  await notifySalesperson(leadId);
} else {
  // Responder con IA
  await sendAIResponse(message);
}
```

### 3. Personalización por Sucursal

```typescript
// Cada sucursal puede tener su propia configuración
const branchConfigs = {
  'santiago-centro': {
    personality: 'formal',
    response_hours: { start: '09:00', end: '19:00' }
  },
  'valparaiso': {
    personality: 'casual',
    response_hours: { start: '10:00', end: '18:00' }
  }
};
```

### 4. Testing antes de Producción

```typescript
// Modo de prueba: no enviar mensajes reales
const testMode = process.env.NODE_ENV === 'development';

if (testMode) {
  console.log('TEST MODE: Would send message:', message);
} else {
  await sendWhatsAppMessage(message);
}
```

## 🚨 Manejo de Errores

### Reintentar Workflow Fallido

```typescript
// En caso de error, reintentar automáticamente
const maxRetries = 3;
let attempt = 0;

while (attempt < maxRetries) {
  try {
    await N8nService.executeWorkflow(workspaceId, 'whatsapp-to-crm', data);
    break;
  } catch (error) {
    attempt++;
    if (attempt >= maxRetries) {
      // Notificar al admin
      await notifyAdmin('Workflow failed after 3 attempts', error);
    }
    // Esperar antes de reintentar
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
}
```

## 📞 Soporte

Para más ejemplos o ayuda:
- Documentación completa: `/docs/N8N_INTEGRATION_README.md`
- Workflows templates: `/docs/n8n_workflows_templates.md`
- Instalación Docker: `/docs/n8n_docker_setup.md`
