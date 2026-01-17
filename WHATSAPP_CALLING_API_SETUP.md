# WhatsApp Business Calling API → SKALE MOTORS

Esta guía explica cómo integrar la **WhatsApp Business Calling API** en SKALE MOTORS para realizar y recibir llamadas directamente desde la plataforma.

## 📋 Requisitos Previos

1. **Cuenta de WhatsApp Business API** activa (a través de un BSP como YCloud, Twilio, etc.)
2. **Acceso a WhatsApp Calling API** (disponible desde julio 2025)
3. **Número de teléfono verificado** en WhatsApp Business
4. **Consentimiento del usuario** antes de realizar llamadas salientes

## 🔧 1. Configuración de Base de Datos

Ejecuta en **Supabase Dashboard → SQL Editor**:

```sql
-- Tabla para almacenar llamadas de WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL, -- ID único de la llamada del proveedor
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('entrante', 'saliente')),
  status TEXT NOT NULL CHECK (status IN ('iniciando', 'en_curso', 'completada', 'fallida', 'cancelada', 'no_contestada')),
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  transcript TEXT,
  user_id UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id),
  inbox_id UUID REFERENCES public.whatsapp_inboxes(id),
  lead_id UUID REFERENCES public.leads(id),
  notes TEXT,
  provider_call_id TEXT, -- ID del proveedor (YCloud, Twilio, etc.)
  raw_payload JSONB, -- Payload completo del webhook
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_contact_phone ON public.whatsapp_calls(contact_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_branch_id ON public.whatsapp_calls(branch_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_user_id ON public.whatsapp_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_status ON public.whatsapp_calls(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_calls_created_at ON public.whatsapp_calls(created_at DESC);

-- RLS Policies
ALTER TABLE public.whatsapp_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo ven llamadas de su sucursal
CREATE POLICY "Users can view calls from their branch"
  ON public.whatsapp_calls FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM public.users WHERE id = auth.uid()
    )
    OR branch_id IS NULL
  );

-- Policy: Los usuarios pueden crear llamadas
CREATE POLICY "Users can create calls"
  ON public.whatsapp_calls FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Los usuarios pueden actualizar llamadas de su sucursal
CREATE POLICY "Users can update calls from their branch"
  ON public.whatsapp_calls FOR UPDATE
  USING (
    branch_id IN (
      SELECT branch_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_calls_updated_at
  BEFORE UPDATE ON public.whatsapp_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_calls_updated_at();
```

## 🚀 2. Edge Functions (Supabase)

### 2.1 Función para Iniciar Llamadas

Crea `supabase/functions/whatsapp-call/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: unknown): string {
  const s = String(phone ?? "").trim();
  if (!s) throw new Error("Missing phone");
  const cleaned = s.startsWith("+")
    ? "+" + s.slice(1).replace(/[^\d]/g, "")
    : s.replace(/[^\d]/g, "");
  return cleaned;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Missing auth" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const to = normalizePhone(b.to);
  const inboxId = String(b.inbox_id ?? "").trim() || null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { ok: false, error: "Invalid auth" });
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await admin
    .from("users")
    .select("id, branch_id, full_name")
    .eq("id", userId)
    .maybeSingle();

  const branchId = profile?.branch_id ?? null;

  // Determinar inbox
  let resolvedInboxId = inboxId;
  if (!resolvedInboxId) {
    const { data: inbox } = await admin
      .from("whatsapp_inboxes")
      .select("id")
      .eq("branch_id", branchId)
      .maybeSingle();
    resolvedInboxId = inbox?.id ?? null;
  }

  // Configuración YCloud para llamadas
  const ycloudBase = Deno.env.get("YCLOUD_API_BASE") || "https://api.ycloud.com";
  const ycloudAuthHeader = Deno.env.get("YCLOUD_AUTH_HEADER") || "X-API-Key";
  const ycloudAuthValue = Deno.env.get("YCLOUD_AUTH_VALUE") || Deno.env.get("YCLOUD_API_KEY") || "";
  const ycloudFrom = Deno.env.get("YCLOUD_WHATSAPP_FROM") || "";

  if (!ycloudAuthValue) {
    return jsonResponse(500, { ok: false, error: "Missing YCLOUD auth env vars" });
  }

  // Endpoint para iniciar llamada (ajusta según la API de tu proveedor)
  const callPath = Deno.env.get("YCLOUD_CALL_PATH") || "/v2/whatsapp/calls";
  const url = `${ycloudBase.replace(/\/$/, "")}${callPath}`;

  const callPayload = {
    from: ycloudFrom || undefined,
    to,
    type: "voice",
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [ycloudAuthHeader]: ycloudAuthValue,
      },
      body: JSON.stringify(callPayload),
    });

    const respText = await resp.text();
    let respJson: unknown = null;
    try {
      respJson = JSON.parse(respText);
    } catch {
      // Si no es JSON, usar el texto
    }

    if (!resp.ok) {
      return jsonResponse(resp.status, {
        ok: false,
        error: `YCloud error: ${resp.status} ${resp.statusText}`,
        details: respJson,
      });
    }

    const callId = (respJson as Record<string, unknown>)?.id || 
                   (respJson as Record<string, unknown>)?.call_id || 
                   `call_${Date.now()}`;

    // Guardar en la base de datos
    const { data: callData, error: dbError } = await admin
      .from("whatsapp_calls")
      .insert({
        call_id: String(callId),
        contact_phone: to,
        direction: "saliente",
        status: "iniciando",
        user_id: userId,
        branch_id: branchId,
        inbox_id: resolvedInboxId,
        provider_call_id: String(callId),
        raw_payload: respJson as Record<string, unknown>,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving call to DB:", dbError);
      // Continuar aunque falle el guardado
    }

    return jsonResponse(200, {
      ok: true,
      call_id: callId,
      call: callData,
    });
  } catch (error) {
    console.error("Error calling YCloud:", error);
    return jsonResponse(500, {
      ok: false,
      error: "Failed to initiate call",
      details: String(error),
    });
  }
}
```

### 2.2 Webhook para Eventos de Llamadas

Crea `supabase/functions/whatsapp-call-webhook/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  // Validar webhook token (opcional pero recomendado)
  const token = req.headers.get("x-webhook-token") || 
                new URL(req.url).searchParams.get("token");
  const expectedToken = Deno.env.get("YCLOUD_WEBHOOK_TOKEN");
  
  if (expectedToken && token !== expectedToken) {
    return jsonResponse(401, { ok: false, error: "Invalid webhook token" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const payload = body as Record<string, unknown>;
  const callId = String(payload.call_id || payload.id || "");
  const event = String(payload.event || payload.status || "");
  const phone = String(payload.to || payload.from || "");

  if (!callId) {
    return jsonResponse(400, { ok: false, error: "Missing call_id" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Mapear eventos del proveedor a estados internos
  const statusMap: Record<string, string> = {
    "initiated": "iniciando",
    "ringing": "iniciando",
    "answered": "en_curso",
    "completed": "completada",
    "failed": "fallida",
    "canceled": "cancelada",
    "no-answer": "no_contestada",
    "busy": "fallida",
  };

  const newStatus = statusMap[event.toLowerCase()] || "en_curso";
  const updateData: Record<string, unknown> = {
    status: newStatus,
    raw_payload: payload,
    updated_at: new Date().toISOString(),
  };

  // Si la llamada terminó, actualizar duración y ended_at
  if (newStatus === "completada" || newStatus === "fallida" || newStatus === "cancelada" || newStatus === "no_contestada") {
    updateData.ended_at = new Date().toISOString();
    if (payload.duration) {
      updateData.duration_seconds = Number(payload.duration);
    }
  }

  // Si hay grabación o transcripción
  if (payload.recording_url) {
    updateData.recording_url = String(payload.recording_url);
  }
  if (payload.transcript) {
    updateData.transcript = String(payload.transcript);
  }

  // Buscar la llamada por call_id o provider_call_id
  const { data: existingCall } = await admin
    .from("whatsapp_calls")
    .select("id")
    .or(`call_id.eq.${callId},provider_call_id.eq.${callId}`)
    .maybeSingle();

  if (existingCall) {
    // Actualizar llamada existente
    const { error } = await admin
      .from("whatsapp_calls")
      .update(updateData)
      .eq("id", existingCall.id);

    if (error) {
      console.error("Error updating call:", error);
      return jsonResponse(500, { ok: false, error: "Failed to update call" });
    }
  } else {
    // Crear nueva llamada (llamada entrante)
    const { error } = await admin
      .from("whatsapp_calls")
      .insert({
        call_id: callId,
        contact_phone: phone,
        direction: "entrante",
        status: newStatus,
        provider_call_id: callId,
        raw_payload: payload,
        started_at: new Date().toISOString(),
        ...updateData,
      });

    if (error) {
      console.error("Error creating call:", error);
      return jsonResponse(500, { ok: false, error: "Failed to create call" });
    }
  }

  return jsonResponse(200, { ok: true });
}
```

## 🔐 3. Variables de Entorno

Configura en Supabase (Functions → Secrets):

```
# Ya existentes para mensajes
YCLOUD_API_BASE=https://api.ycloud.com
YCLOUD_AUTH_HEADER=X-API-Key
YCLOUD_AUTH_VALUE=tu_api_key_aqui
YCLOUD_WHATSAPP_FROM=tu_phone_number_id

# Nuevas para llamadas
YCLOUD_CALL_PATH=/v2/whatsapp/calls
YCLOUD_WEBHOOK_TOKEN=tu_token_secreto
```

## 📞 4. Servicio Frontend

Crea `src/lib/services/whatsappCalls.ts`:

```typescript
import { supabase } from "@/lib/supabase";

export type WhatsappCallStatus = 'iniciando' | 'en_curso' | 'completada' | 'fallida' | 'cancelada' | 'no_contestada';
export type WhatsappCallDirection = 'entrante' | 'saliente';

export type WhatsappCall = {
  id: string;
  call_id: string;
  contact_phone: string;
  contact_name: string | null;
  direction: WhatsappCallDirection;
  status: WhatsappCallStatus;
  duration_seconds: number;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  transcript: string | null;
  user_id: string | null;
  branch_id: string | null;
  lead_id: string | null;
  notes: string | null;
  created_at: string;
};

export async function initiateWhatsappCall(params: {
  to: string;
  inboxId?: string | null;
}): Promise<{ call_id: string; call: WhatsappCall }> {
  const { to, inboxId } = params;
  
  const { data, error } = await supabase.functions.invoke("whatsapp-call", {
    body: {
      to,
      inbox_id: inboxId ?? null,
    },
  });

  if (error) throw error;
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to initiate call");
  }

  return data;
}

export async function fetchWhatsappCalls(params: {
  branchId?: string | null;
  limit?: number;
  status?: WhatsappCallStatus;
}): Promise<WhatsappCall[]> {
  const { branchId, limit = 100, status } = params;

  let query = supabase
    .from("whatsapp_calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as WhatsappCall[];
}

export async function updateCallNotes(callId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_calls")
    .update({ notes })
    .eq("id", callId);

  if (error) throw error;
}
```

## 🎨 5. Actualizar Página de Llamadas

Actualiza `src/pages/Calls.tsx` para incluir llamadas de WhatsApp.

## ⚠️ Notas Importantes

1. **Consentimiento**: WhatsApp requiere consentimiento explícito antes de llamadas salientes
2. **Disponibilidad**: Verifica que la Calling API esté disponible en tu región
3. **Proveedor**: Ajusta los endpoints según tu BSP (YCloud, Twilio, etc.)
4. **Costos**: Las llamadas tienen costos asociados, revisa los precios de tu proveedor
