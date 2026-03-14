# Diagnóstico y arquitectura IA — Skale Motors v2

## PARTE 1 — DIAGNÓSTICO

### a) ChatContext actual

| Aspecto | Estado | Detalle |
|--------|--------|---------|
| **Implementación** | ✅ Parcial | Solo controla **apertura/cierre** del panel flotante: `isChatOpen`, `openChat`, `closeChat`, `toggleChat`. No guarda mensajes ni llama a ninguna API. |
| **Chat real** | ✅ Implementado fuera del contexto | El chat con IA está en **SupportChat.tsx**: usa `sendSupportChatMessage()` de `supportChatApi.ts` → Edge Function **support-chat** (OpenAI). Incluye historial, loading, errores en español. |
| **Conclusión** | 🟡 | ChatContext = solo UI (abrir/cerrar). La lógica de mensajes y llamada a IA está en SupportChat + support-chat. Para la misión se pide centralizar en ChatContext y usar ai-chat (Anthropic). |

### b) Páginas en studio-ia/

| Página | Ruta actual | Conectada a IA real | Notas |
|--------|-------------|---------------------|--------|
| **StudioIA.tsx** | /app/studio-ia | No (hub) | Tarjetas que enlazan a herramientas. |
| **DescripcionesVehiculos** | /app/studio-ia/content/descriptions | ✅ | `studioIaApi.generateVehicleDescription` → Edge Function studio-ia-generate (webhook n8n o OpenAI). Fallback plantilla local. |
| **GeneradorGuiones** | /app/studio-ia/content/script-generator | ✅ | `studioIaApi.generateReelScript` → studio-ia-generate (reel_script, OpenAI). Fallback plantilla local. |
| **ChatbotAutomotora** | /app/studio-ia/automation/chatbot | 🔴 | Placeholder "Próximamente". Sin API. |
| **Otras** | Varias | Varían | GeneradorPosts, ScriptsLlamadas, SEO, etc. No todas revisadas para esta misión. |

**Gap:** No existe página dedicada **Chat IA** (/app/studio-ia/chat) ni **Guión de venta** (para lead) ni **Respuesta a lead**. Descripción de vehículo y guión reels sí están conectadas a IA real (OpenAI).

### c) Edge Functions existentes (supabase/functions/)

| Función | Propósito | IA |
|---------|-----------|-----|
| **studio-ia-generate** | Descripción vehículo (webhook n8n o OpenAI), guión reels (OpenAI) | ✅ OpenAI gpt-4o-mini |
| **support-chat** | Chat “cerebro del negocio”: métricas (ventas, inventario, leads, finanzas) + OpenAI | ✅ OpenAI gpt-4o-mini |
| lead-state-update, pending-task-create, whatsapp-*, ycloud-webhook, marketplace-*, etc. | Otros flujos | No IA |

**Conclusión:** Ya hay dos funciones de IA (OpenAI). La misión pide **ai-chat** y **ai-generate** con **Anthropic** (claude-sonnet-4-20250514).

### d) Variables de entorno

| Dónde | Variable | Estado |
|-------|----------|--------|
| env.example | OPENAI_API_KEY (comentada) | 🟡 Documentada para Supabase Secrets |
| env.example | N8N_DESCRIPTION_WEBHOOK_URL (opcional) | 🟡 |
| Supabase Edge Functions | OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY | Usadas por studio-ia-generate y support-chat |
| Frontend | Ninguna key de IA | ✅ Correcto (keys en backend) |

**Falta:** ANTHROPIC_API_KEY en Supabase Secrets para las nuevas Edge Functions.

### e) Resumen de gaps

| Área | Estado | Acción |
|------|--------|--------|
| Modelo LLM | 🔴 OpenAI en uso | Añadir flujo Anthropic (claude-sonnet-4-20250514) en ai-chat y ai-generate |
| Tablas IA | 🔴 No existen | Crear ai_conversations, ai_messages, ai_usage_logs con RLS |
| Edge Function chat con datos | 🟡 support-chat hace algo similar | Crear ai-chat (Anthropic) con mismo patrón de contexto; opcional deprecar support-chat |
| Edge Function generación multi-tool | 🟡 studio-ia-generate tiene 2 tipos | Crear ai-generate (Anthropic) con vehicle_description, sales_script, lead_response, monthly_summary, whatsapp_followup |
| ChatContext | 🟡 Solo open/close | Añadir estado de conversación, sendMessage, clearConversation, usar aiService |
| Página Chat Studio IA | 🔴 No existe | Crear /app/studio-ia/chat con historial y sugerencias |
| Página Descripción vehículo | ✅ Existe | Conectar a ai-generate si se unifica; o mantener studio-ia-generate |
| Página Guión de venta (para lead) | 🔴 No existe | Crear /app/studio-ia/guion-venta con select lead y ai-generate |
| Página Respuesta a lead | 🔴 No existe | Crear /app/studio-ia/respuesta-lead con textarea y ai-generate |
| Sidebar Studio IA | 🟡 Un solo ítem “Studio IA” | Añadir subítems: Chat IA, Descripción vehículo, Guión venta, Respuesta lead |
| Rutas | 🟡 | Añadir /app/studio-ia/chat, guion-venta, respuesta-lead |

---

## CEREBRO POR SUCURSAL (SKALEGPT)

Un **cerebro por sucursal** (branch): todos los usuarios de esa sucursal comparten el mismo snapshot del negocio. El agente puede “leer” inventario, consignaciones, ventas, leads, citas y finanzas sin hacer todas las consultas en cada mensaje.

- **Tabla** `ai_branch_brain`: `branch_id`, `snapshot_text` (texto con todas las métricas), `updated_at`.
- **Flujo**: Al enviar un mensaje a ai-chat con `branchId`, la función intenta leer el cerebro de esa sucursal. Si no existe o tiene más de 15 min, construye el snapshot (consultas a vehicles, consignaciones, sales, leads, appointments, ingresos_empresa, gastos_empresa, finance_month_summary), lo guarda en `ai_branch_brain` y lo usa como contexto para el LLM.
- **Refresh opcional**: Edge Function `ai-brain-refresh`. POST sin body = refresca todas las sucursales; POST `{ "branchId": "uuid" }` = refresca solo esa. Útil para cron cada 15–30 min.

**Despliegue:**
1. Aplicar migración `20260802120000_ai_branch_brain.sql`.
2. Desplegar `ai-chat` y, si quieres refresh programado, `ai-brain-refresh`.
3. (Opcional) Llamar a `ai-brain-refresh` cada 15 min vía Supabase cron o servicio externo.

---

## PARTE 2 — MODELO DE DATOS (ver migraciones en supabase/migrations/)

- **ai_conversations**: id, user_id, branch_id, title, created_at, updated_at. RLS: usuario ve las suyas por branch_id o admin ve todo.
- **ai_messages**: id, conversation_id, role ('user'|'assistant'), content, tokens_used, created_at. RLS vía conversation (user_id/branch).
- **ai_usage_logs**: id, user_id, branch_id, feature, tokens_input, tokens_output, model, created_at. RLS por branch_id o admin.

---

## PARTE 7 — VARIABLES DE ENTORNO

**Supabase Edge Functions (Secrets):**
- `ANTHROPIC_API_KEY` — obligatorio para ai-chat y ai-generate.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — ya existentes.

**Frontend:** No se exponen keys de IA.

**Configurar:**
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

---

## PARTE 9 — PLAN DE IMPLEMENTACIÓN

### FASE 1 — Backend e infraestructura
- [x] Migración SQL: ai_conversations, ai_messages, ai_usage_logs con RLS — `supabase/migrations/20260801120000_ai_conversations_messages_usage.sql`
- [x] Edge Function ai-chat (Anthropic, contexto negocio) — `supabase/functions/ai-chat/index.ts`
- [x] Edge Function ai-generate (Anthropic, tools: vehicle_description, sales_script, lead_response, monthly_summary, whatsapp_followup) — `supabase/functions/ai-generate/index.ts`
- [ ] Configurar en Supabase: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
- [ ] Desplegar: `supabase functions deploy ai-chat --no-verify-jwt`, `supabase functions deploy ai-generate --no-verify-jwt`
- [ ] Aplicar migración en el proyecto (Supabase Dashboard o `supabase db push`)

### FASE 2 — Servicios y contexto frontend
- [x] Crear `src/lib/services/aiService.ts` (sendChatMessage, generateText, tipos AIChatOptions, AIGenerateOptions, AITool)
- [x] Actualizar ChatContext: messages, sendMessage, clearConversation, isLoading, error, uso de aiService y branch_id del usuario
- [x] Actualizar SupportChat para usar useChat() (mensajes, enviar, limpiar) en lugar de supportChatApi

### FASE 3 — Páginas y UI
- [x] Página Chat IA: `/app/studio-ia/chat` — ChatIA.tsx con sugerencias, historial, useChat()
- [x] Ruta descripción vehículo: `/app/studio-ia/descripcion-vehiculo` → DescripcionesVehiculos (existente)
- [x] Página Guión de Venta: `/app/studio-ia/guion-venta` — GuionVenta.tsx (select lead, datos, ai-generate sales_script)
- [x] Página Respuesta a Lead: `/app/studio-ia/respuesta-lead` — RespuestaLead.tsx (mensaje, tono, ai-generate lead_response)
- [x] Rutas en App.tsx para chat, descripcion-vehiculo, guion-venta, respuesta-lead
- [x] Sidebar: nueva categoría "Studio IA" con Chat IA, Descripción de Vehículo, Guión de Venta, Respuesta a Lead

### FASE 4 — Testing y ajuste de prompts
- [ ] Probar ai-chat con preguntas de inventario, ventas, balance.
- [ ] Probar ai-generate para cada tool (vehicle_description, sales_script, lead_response, etc.).
- [ ] Ajustar prompts en ai-chat/ai-generate si hace falta (español chileno, pesos, tono).
