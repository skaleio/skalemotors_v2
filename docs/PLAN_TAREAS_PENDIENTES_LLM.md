# Plan: Tareas Pendientes + LLM + Supabase + n8n/WhatsApp

## Objetivo

Implementar la tarjeta de **Tareas Pendientes** del dashboard con datos reales: alertas generadas por **situaciones desfavorables** (leads sin contactar, seguimientos vencidos, citas sin confirmar, etc.), **consolidadas** para no mostrar 70 alertas cuando hay 70 leads sin contactar, y con posibilidad de que mensajes de **recordatorio** enviados al agente de WhatsApp generen tareas vía **n8n → endpoint**.

---

## 1. Modelo de datos en Supabase (MCP)

### Tabla `pending_tasks`

Todas las tareas/alertas que ve el usuario en la tarjeta del dashboard.

| Campo           | Tipo        | Descripción |
|-----------------|-------------|-------------|
| id              | uuid        | PK, default uuid_generate_v4() |
| branch_id       | uuid        | FK branches, obligatorio |
| assigned_to     | uuid        | FK users, opcional (si la tarea es para un vendedor) |
| priority        | text        | `urgent` \| `today` \| `later` (equivale a URGENTE / HOY / resto) |
| title           | text        | Ej: "Contactar a Juan Pérez" |
| description     | text        | Ej: "Lead nuevo sin contactar - Hace 2 horas" |
| action_type     | text        | `contactar` \| `llamar` \| `confirmar` \| `enviar_cotizacion` \| `otro` |
| action_label    | text        | Texto del botón: "Contactar", "Llamar", "Confirmar", etc. |
| entity_type     | text        | `lead` \| `appointment` \| `custom` |
| entity_id       | uuid        | lead_id, appointment_id o null para custom |
| metadata        | jsonb       | Datos extra (ej. vehicle_name, phone) |
| source          | text        | `rule` \| `llm` \| `whatsapp` (origen de la tarea) |
| due_at          | timestamptz | Opcional, para “para completar hoy” |
| completed_at    | timestamptz | Si está completada (null = pendiente) |
| created_at      | timestamptz | now() |

- **RLS**: por `branch_id` (mismo criterio que leads/appointments).
- Índices: `branch_id`, `(branch_id, completed_at)`, `due_at` para listados rápidos.

Con esto el frontend puede listar tareas por sucursal, filtrar no completadas y ordenar por prioridad/fecha.

---

## 2. Origen de las tareas (lógica)

### 2.1 Reglas automáticas (situaciones desfavorables)

Se pueden implementar con:

- **Opción A – Solo SQL/DB**: función o job (pg_cron / Supabase Edge scheduled) que:
  - Detecte: leads con `status = 'nuevo'` y `last_contact_at` null y `created_at` &lt; now() - 2 horas.
  - Detecte: leads con `next_follow_up` &lt; now() y no vendido/perdido.
  - Detecte: citas con `status = 'programada'`, `scheduled_at` en las próximas 24–48 h y sin confirmar.
  - Inserte filas en `pending_tasks` (una por lead/cita o agrupadas; ver 2.3).

- **Opción B – Con LLM**: un proceso (Edge Function o n8n programado) que:
  - Reciba un resumen: conteos y ejemplos (ej. “70 leads sin contactar”, “5 seguimientos vencidos”, “3 test drives mañana sin confirmar”).
  - El LLM devuelva una lista corta de tareas priorizadas/consolidadas (ej. “Contactar leads sin contactar (mostrar 3 representativos)” o “Confirmar test drives de mañana”).
  - El mismo proceso escriba en `pending_tasks` con `source = 'llm'`.

La consolidación (no 70 alertas) se resuelve así: o bien se insertan solo N tareas “representativas” + una tarea tipo “Ver X más en Leads”, o el LLM devuelve títulos agrupados y se inserta una tarea por grupo.

### 2.2 WhatsApp / recordatorio → tarea

Flujo deseado:

1. Usuario envía un mensaje al agente de WhatsApp que se interpreta como **recordatorio** o **cosa por hacer** (ej. “recuérdame llamar a Juan mañana”, “tengo que enviar la cotización a María”).
2. El workflow de n8n (WHATSAPP HESSEN) recibe el mensaje.
3. Un nodo (Switch por tipo de mensaje o un LLM de clasificación) detecta “recordatorio / tarea”.
4. Un paso con LLM extrae: título, descripción, prioridad, fecha si aplica.
5. n8n llama a un **endpoint HTTP** (Edge Function en Supabase) que crea una fila en `pending_tasks` con `source = 'whatsapp'`.

Ventaja de usar **HTTP a una Edge Function** (igual que `lead-state-update`):

- Un solo lugar para validar y escribir en Supabase.
- Se puede usar API key (header) para autorizar solo a n8n.
- Misma red y seguridad que el resto del proyecto.

Alternativa: webhook público que inserte vía Supabase client con service role; la Edge Function es más consistente con el resto del proyecto.

---

## 3. Endpoint para crear tarea desde n8n

- **Nombre sugerido**: `pending-task-create` (Edge Function).
- **Método**: POST.
- **Headers**: `Content-Type: application/json`, `x-api-key` (o Authorization) con una clave configurada en env (ej. `PENDING_TASK_API_KEY`).
- **Body** (ejemplo):

```json
{
  "branch_id": "uuid",
  "title": "Llamar a Juan por cotización",
  "description": "Solicitó cotización Mazda CX-5 ayer",
  "priority": "today",
  "action_type": "llamar",
  "action_label": "Llamar",
  "entity_type": "lead",
  "entity_id": "uuid-del-lead",
  "due_at": "2025-02-09T18:00:00Z",
  "source": "whatsapp"
}
```

- La función valida `branch_id`, opcionalmente `entity_id` (que exista el lead/cita), inserta en `pending_tasks` y devuelve `{ ok: true, data: { id, ... } }`.

Así, cualquier workflow de n8n (no solo WhatsApp) puede crear tareas enviando POST a esta función.

**URL (tras desplegar):** `https://<PROJECT_REF>.supabase.co/functions/v1/pending-task-create`  
**Variable de entorno en Supabase (Edge Function):** `PENDING_TASK_API_KEY` — configurar en Dashboard > Project Settings > Edge Functions (o en secrets).  
**En n8n:** usar credencial "Header Auth" con header `x-api-key` y el mismo valor.

---

## 4. Frontend (Dashboard)

- **Hook**: `usePendingTasks(branchId)` que haga `from('pending_tasks').select(...).eq('branch_id', branchId).is('completed_at', null).order('priority', { ascending: false }).order('due_at', { nullsFirst: false })`.
- **Tarjeta Tareas Pendientes**:
  - Contador “X urgentes” desde tareas con `priority = 'urgent'`.
  - Sección URGENTE: tareas con `priority = 'urgent'`.
  - Sección HOY: tareas con `priority = 'today'` (o `due_at` hoy).
  - Botones de acción según `action_type` / `entity_type`: navegar a `/leads/:id`, `/appointments/:id`, o abrir modal de contacto/llamada.
  - Al ejecutar la acción (o desde un “Marcar hecha”), actualizar la tarea: `completed_at = now()`.
- Eliminar datos mock y reemplazarlos por la lista real desde Supabase.

---

## 5. n8n – Integración WhatsApp → recordatorio

En el workflow WHATSAPP HESSEN (o en un sub-workflow llamado desde él):

1. **Clasificación del mensaje**: después de tener el texto (o respuesta del agente), añadir un nodo que determine si el mensaje es “recordatorio” / “tarea” (por palabras clave o con un pequeño LLM que devuelva `is_reminder: true/false`).
2. **Si es recordatorio**: nodo LLM que extraiga de la conversación:
   - title
   - description
   - priority (urgent | today | later)
   - due_at (opcional)
   - action_type / action_label
   - entity_id (si se puede asociar a un lead por teléfono, usando Supabase)
3. **HTTP Request** a la Edge Function `pending-task-create` con el body anterior. Usar credencial tipo Header Auth con `x-api-key` para la API key del proyecto.

Opcional: responder al usuario por WhatsApp confirmando “Anotado: [título]. Te lo mostraré en el panel de tareas.”

---

## 6. Orden de implementación sugerido

1. **Supabase (MCP)**  
   - Crear tabla `pending_tasks` con RLS e índices.  
   - Opcional: función o vista para “situaciones desfavorables” (solo lectura) que luego alimente un job o el LLM.

2. **Edge Function**  
   - `pending-task-create`: validar body, insertar en `pending_tasks`, devolver JSON.

3. **Frontend**  
   - Hook `usePendingTasks`, reemplazar mock en Dashboard por datos reales y acciones (navegar a lead/cita, marcar completada).

4. **Generación automática de tareas (reglas)**  
   - Edge Function programada o pg_cron que inserte tareas desde “situaciones desfavorables” (con o sin LLM para consolidar). Empezar con reglas fijas (ej. top 5 leads sin contactar, seguimientos vencidos, citas sin confirmar).

5. **n8n – recordatorio**  
   - Añadir rama “recordatorio” en el workflow de WhatsApp, LLM de extracción, llamada a `pending-task-create`.

6. **LLM de consolidación (opcional)**  
   - Si se quiere que un LLM decida qué alertas mostrar cuando hay muchas, añadir un paso que lea resumen de situaciones, llame al LLM y escriba en `pending_tasks` con `source = 'llm'`.

---

## 7. Resumen

- **Tareas pendientes**: tabla `pending_tasks` en Supabase, RLS por sucursal, alimentada por reglas automáticas y/o LLM y por mensajes de WhatsApp vía n8n.
- **Consolidación**: reglas que insertan pocas tareas “representativas” o un LLM que resume y prioriza; no una fila por cada lead sin contactar.
- **WhatsApp → tarea**: clasificar mensaje como recordatorio, extraer datos con LLM, POST a Edge Function `pending-task-create`.
- **Comunicación n8n ↔ Supabase**: HTTP a Edge Function con API key, igual que `lead-state-update`.

Si estás de acuerdo con este plan, el siguiente paso concreto es: **crear la tabla `pending_tasks` y la Edge Function `pending-task-create`** usando Supabase MCP y el repo actual.
