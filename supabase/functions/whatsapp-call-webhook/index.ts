import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
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

  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
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
