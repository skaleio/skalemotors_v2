/// <reference path="../_shared/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_GENERATE = 2048;
const TEMPERATURE_GENERATE = 0.7;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Tool =
  | "vehicle_description"
  | "sales_script"
  | "lead_response"
  | "monthly_summary"
  | "whatsapp_followup";

type RequestBody = {
  tool: Tool;
  data: Record<string, unknown>;
  branchId?: string | null;
};

function buildPrompt(tool: Tool, data: Record<string, unknown>): { system: string; user: string } {
  switch (tool) {
    case "vehicle_description": {
      const make = (data.make as string) || "";
      const model = (data.model as string) || "";
      const year = (data.year as string) || "";
      const mileage = (data.mileage as string) || "";
      const color = (data.color as string) || "";
      const features = (data.features as string) || "";
      const price = (data.price as string) || "";
      const system = `Eres un copywriter experto en automoción. Generas descripciones de vehículos en español para Chile, profesionales y atractivas, listas para publicar en portales o redes. Tono profesional de automotora. Responde ÚNICAMENTE con el texto de la descripción, sin títulos adicionales. Usa pesos chilenos con formato $X.XXX.XXX.`;
      const user = `Genera una descripción para: Marca ${make}, Modelo ${model}, Año ${year}.${mileage ? ` Kilometraje: ${mileage} km.` : ""}${color ? ` Color: ${color}.` : ""}${features ? ` Características: ${features}` : ""}${price ? ` Precio: $${price}.` : ""}\n\nResponde solo con el texto de la descripción.`;
      return { system, user };
    }
    case "sales_script": {
      const leadName = (data.leadName as string) || "el prospecto";
      const vehicleInterest = (data.vehicleInterest as string) || "vehículo de interés";
      const budget = (data.budget as string) || "";
      const previousInteractions = (data.previousInteractions as string) || "";
      const system = `Eres un experto en ventas de automóviles. Redactas guiones de venta en español chileno para vendedores de automotora: apertura, manejo de objeciones y cierre. Tono profesional y cercano.`;
      const user = `Genera un guión de venta para contactar a ${leadName}. Vehículo de interés: ${vehicleInterest}.${budget ? ` Presupuesto aproximado: ${budget}.` : ""}${previousInteractions ? ` Contexto de interacciones previas: ${previousInteractions}` : ""}\n\nIncluye: 1) Apertura (presentación y gancho), 2) Manejo de objeciones típicas, 3) Cierre (próximo paso o cita). Responde solo con el guión.`;
      return { system, user };
    }
    case "lead_response": {
      const leadMessage = (data.leadMessage as string) || "";
      const leadHistory = (data.leadHistory as string) || "";
      const vehicleInterest = (data.vehicleInterest as string) || "";
      const tone = ((data.tone as string) || "formal") as "formal" | "cercano" | "urgente";
      const toneLabel = tone === "formal" ? "formal y profesional" : tone === "cercano" ? "cercano y amigable" : "directo y urgente";
      const system = `Eres un asistente de ventas de una automotora. Generas respuestas sugeridas a mensajes de leads en español chileno. Tono ${toneLabel}. Respuestas concisas, útiles y que inviten al siguiente paso (llamada, visita, test drive). Responde ÚNICAMENTE con el texto de la respuesta sugerida.`;
      const user = `Mensaje recibido del lead:\n"${leadMessage}"\n${vehicleInterest ? `Vehículo de interés: ${vehicleInterest}.` : ""}${leadHistory ? `\nContexto/historial: ${leadHistory}` : ""}\n\nGenera una respuesta sugerida (solo el texto, sin explicaciones).`;
      return { system, user };
    }
    case "monthly_summary": {
      const income = (data.income as number) ?? 0;
      const expenses = (data.expenses as number) ?? 0;
      const balance = (data.balance as number) ?? 0;
      const topVehicles = (data.topVehicles as string) || "";
      const leads = (data.leads as string) || "";
      const system = `Eres un analista de negocio para automotoras. Redactas resúmenes ejecutivos del mes en español chileno: claros, con números formateados en pesos ($X.XXX.XXX) y conclusiones breves. Tono profesional.`;
      const user = `Genera un resumen ejecutivo del mes con: Ingresos: $${Number(income).toLocaleString("es-CL")}. Gastos: $${Number(expenses).toLocaleString("es-CL")}. Balance: $${Number(balance).toLocaleString("es-CL")}.${topVehicles ? ` Vehículos destacados: ${topVehicles}.` : ""}${leads ? ` Leads: ${leads}.` : ""}\n\nResponde solo con el resumen (párrafos cortos, sin títulos genéricos tipo "Resumen").`;
      return { system, user };
    }
    case "whatsapp_followup": {
      const leadName = (data.leadName as string) || "el cliente";
      const daysSinceContact = (data.daysSinceContact as number) ?? 0;
      const vehicleInterest = (data.vehicleInterest as string) || "";
      const system = `Eres un asistente de ventas. Redactas mensajes cortos de seguimiento por WhatsApp para automotora, en español chileno. Tono cercano pero profesional. Mensajes breves (1-3 oraciones), con emoji moderado. Responde ÚNICAMENTE con el texto del mensaje.`;
      const user = `Genera un mensaje de seguimiento para ${leadName}. Días desde último contacto: ${daysSinceContact}.${vehicleInterest ? ` Vehículo de interés: ${vehicleInterest}.` : ""}\n\nSolo el texto del mensaje, listo para copiar y enviar.`;
      return { system, user };
    }
    default:
      return {
        system: "Eres un asistente útil para una automotora.",
        user: "Genera un texto breve en español.",
      };
  }
}

async function callAnthropic(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS_GENERATE,
      temperature: TEMPERATURE_GENERATE,
      system,
      messages: [{ role: "user" as const, content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const block = data?.content?.find((b) => b.type === "text");
  const text = block?.text;
  if (typeof text !== "string") {
    throw new Error("Anthropic response missing content");
  }
  return text.trim();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse(503, {
      ok: false,
      error: "ANTHROPIC_API_KEY no configurada. Configura el secret en Supabase (Edge Functions).",
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const { tool, data = {} } = body;
  const validTools: Tool[] = [
    "vehicle_description",
    "sales_script",
    "lead_response",
    "monthly_summary",
    "whatsapp_followup",
  ];
  if (!tool || !validTools.includes(tool)) {
    return jsonResponse(400, {
      ok: false,
      error: `tool must be one of: ${validTools.join(", ")}`,
    });
  }

  try {
    const { system, user } = buildPrompt(tool, data);
    const text = await callAnthropic(apiKey, system, user);
    return jsonResponse(200, { ok: true, text });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.error("[ai-generate] error:", errMsg);
    return jsonResponse(500, { ok: false, error: errMsg });
  }
}
