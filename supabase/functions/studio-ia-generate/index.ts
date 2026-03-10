/// <reference path="../_shared/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/** Cliente Supabase en Edge; tipo explícito para que el IDE no infiera unknown. */
type EdgeSupabaseClient = { from(table: string): SupabaseQueryChain };

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_EXAMPLES = 5;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type VehicleDescriptionPayload = {
  make: string;
  model: string;
  year: string;
  /** Opcional: id del vehículo del inventario para enlazar la descripción. */
  vehicle_id?: string;
  mileage?: string;
  color?: string;
  price?: string;
  features?: string;
  tone?: string;
  format?: string;
  /** Versión o variante: Top de Línea, LS, R-Design, Limited, etc. */
  variant?: string;
  /** Motor: 1.6 Turbo, 5.3L V8, etc. */
  engine?: string;
  /** Potencia en CV o HP */
  power_cv?: string;
  /** Torque en Nm */
  torque_nm?: string;
  /** Transmisión: Manual 6 velocidades, Automática, CVT */
  transmission?: string;
  /** Financiable desde (monto CLP) */
  financiable_from?: string;
  /** Destacados: Único dueño, Vehículo verificado ✅ */
  highlights?: string;
  /** Incluir contacto WhatsApp al final (default true) */
  include_contact?: boolean;
  /** Opcional: sucursal para usar prompt específico de tienda */
  branch_id?: string | null;
};

type ReelScriptPayload = {
  topic: string;
  platform: string;
  duration: string;
  style: string;
  hook?: string;
  keyPoints?: string;
  callToAction: string;
  /** Opcional: sucursal para usar prompt específico de tienda */
  branch_id?: string | null;
};

const VEHICLE_DESCRIPTION_SYSTEM_PROMPT = `Eres un copywriter experto en automoción. Generas descripciones de vehículos en español para posts de Instagram, Facebook y TikTok.

Estructura OBLIGATORIA (síguela siempre):

1) TÍTULO: Primera línea "Año Marca Modelo [Versión si aplica] " seguida SIEMPRE de la bandera del país de origen de la marca. Banderas por marca:
   - 🇰🇷 Corea (Hyundai, Kia, SsangYong, Daewoo)
   - 🇺🇸 USA (Chevrolet, Ford, Jeep, Dodge, GMC, Cadillac, Tesla)
   - 🇯🇵 Japón (Toyota, Honda, Nissan, Mazda, Suzuki, Mitsubishi, Subaru, Lexus, Acura)
   - 🇩🇪 Alemania (Mercedes-Benz, BMW, Volkswagen, Audi, Porsche, Opel)
   - 🇸🇪 Suecia (Volvo, Saab)
   - 🇬🇧 Reino Unido (Land Rover, Jaguar, Mini)
   - 🇫🇷 Francia (Peugeot, Renault, Citroën)
   - 🇮🇹 Italia (Fiat, Alfa Romeo)
   Si no sabes el origen, infiere por la marca o usa 🇺🇸.

2) OPCIONAL: Segunda línea "Financiable desde $X" solo si indican financiable desde.

3) TEXTO EXPLICATIVO (obligatorio): Uno o dos párrafos que presenten el vehículo. Incluir: motor (litros, CV, Nm), transmisión, para quién es (familia, ciudad, deporte, etc.) y/o qué destaca (diseño, confiabilidad, estado). Tono profesional y atractivo. Escribe 2-4 oraciones, no solo listes datos; que enganchen antes del bloque de km/precio.

4) BLOQUE DE DATOS: Líneas cortas con kilometraje (ej. 72.000 km), Año XXXX, destacados si hay (Único dueño, Vehículo verificado ✅, excelente estado), "Precio Final: $X.XXX.XXX", "Financiable desde: $X.XXX.XXX".

5) CONTACTO (si piden): 📱 WhatsApp: +56 9 8474 8277 (o el número indicado).

Reglas:
- Responde ÚNICAMENTE con el texto listo para copiar y pegar. Sin títulos extra ni explicaciones fuera del texto.
- Usa SOLO los datos que te pasen. No inventes cifras de motor, CV o torque no indicadas.
- Precios en pesos chilenos con punto de miles: $9.990.000.`;

const REEL_SCRIPT_DEFAULT_SYSTEM = `Eres un guionista experto en contenido corto para redes sociales (reels, TikTok, shorts). Escribes en español, con ganchos fuertes en los primeros segundos y estructura clara: hook, contenido principal, CTA. Responde ÚNICAMENTE con el guión listo para usar, con secciones marcadas (HOOK, CONTENIDO, CTA) y notas breves de producción si aplica.`;

/** Obtiene el system prompt desde studio_prompts (por tipo y opcionalmente sucursal). Fallback: null = usar constante en código. */
async function getSystemPrompt(
  supabase: EdgeSupabaseClient | null,
  type: "vehicle_description" | "reel_script",
  branchId?: string | null
): Promise<string | null> {
  if (!supabase) return null;
  const branchUuid = branchId?.trim() || null;
  // Preferir prompt de la sucursal; si no hay, el default (branch_id null).
  if (branchUuid) {
    const { data: row } = await supabase
      .from("studio_prompts")
      .select("system_prompt")
      .eq("type", type)
      .eq("branch_id", branchUuid)
      .limit(1)
      .maybeSingle();
    if (row?.system_prompt) return row.system_prompt;
  }
  const { data: defaultRow } = await supabase
    .from("studio_prompts")
    .select("system_prompt")
    .eq("type", type)
    .is("branch_id", null)
    .limit(1)
    .maybeSingle();
  return defaultRow?.system_prompt ?? null;
}

async function fetchDescriptionExamples(
  supabase: EdgeSupabaseClient,
  format: string
): Promise<{ content: string }[]> {
  const platform = format === "social" ? "general" : "general";
  const { data, error } = await supabase
    .from("studio_ia_description_examples")
    .select("content")
    .in("platform", [platform, "general"])
    .order("created_at", { ascending: false })
    .limit(MAX_EXAMPLES);
  if (error || !data) return [];
  return data;
}

async function buildVehicleDescriptionPrompt(
  p: VehicleDescriptionPayload,
  supabase: EdgeSupabaseClient | null,
  baseSystem?: string | null
): Promise<{ system: string; user: string }> {
  const format = p.format ?? "social";
  const examples = supabase ? await fetchDescriptionExamples(supabase, format) : [];
  let system = (baseSystem && baseSystem.trim()) ? baseSystem.trim() : VEHICLE_DESCRIPTION_SYSTEM_PROMPT;
  if (examples.length > 0) {
    system += "\n\nEstos son ejemplos de descripciones que usamos. Imita su formato, tono y estructura:\n\n";
    system += examples.map((e) => e.content.trim()).join("\n\n---\n\n");
  }
  const lines = [
    `- Marca: ${p.make}`,
    `- Modelo: ${p.model}`,
    `- Año: ${p.year}`,
    p.variant?.trim() ? `- Versión/variante: ${p.variant}` : "",
    p.mileage ? `- Kilometraje: ${p.mileage} km` : "",
    p.color?.trim() ? `- Color: ${p.color}` : "",
    p.engine?.trim() ? `- Motor: ${p.engine}` : "",
    p.power_cv?.trim() ? `- Potencia: ${p.power_cv} CV` : "",
    p.torque_nm?.trim() ? `- Torque: ${p.torque_nm} Nm` : "",
    p.transmission?.trim() ? `- Transmisión: ${p.transmission}` : "",
    p.price ? `- Precio final: ${p.price} CLP` : "",
    p.financiable_from ? `- Financiable desde: ${p.financiable_from} CLP` : "",
    p.highlights?.trim() ? `- Destacados: ${p.highlights}` : "",
    p.features?.trim() ? `- Características o notas adicionales:\n${p.features}` : "",
    `- Incluir contacto WhatsApp al final: ${p.include_contact !== false ? "sí" : "no"}`,
  ].filter(Boolean);
  const user = `Genera una descripción para posts de redes (IG/FB/TikTok) con estos datos:\n\n${lines.join("\n")}\n\nResponde ÚNICAMENTE con el texto de la descripción listo para copiar y pegar.`;
  return { system, user };
}

function buildReelScriptPrompt(p: ReelScriptPayload, baseSystem?: string | null): { system: string; user: string } {
  const platformLabels: Record<string, string> = {
    instagram: "Instagram Reels",
    tiktok: "TikTok",
    youtube: "YouTube Shorts",
    facebook: "Facebook Reels",
  };
  const styleLabels: Record<string, string> = {
    dynamic: "dinámico y enérgico",
    educational: "educativo",
    entertaining: "entretenido",
    testimonial: "testimonial",
    behind_scenes: "detrás de cámaras",
  };
  const system = (baseSystem && baseSystem.trim()) ? baseSystem.trim() : REEL_SCRIPT_DEFAULT_SYSTEM;
  const user = `Crea un guión para un reel con estas especificaciones:
- Tema: ${p.topic}
- Plataforma: ${platformLabels[p.platform] || p.platform}
- Duración aproximada: ${p.duration} segundos
- Estilo: ${styleLabels[p.style] || p.style}
${p.hook?.trim() ? `- Hook sugerido (úsalo o mejóralo): ${p.hook}` : ""}
${p.keyPoints?.trim() ? `Puntos clave a cubrir:\n${p.keyPoints}` : ""}
- Call to action: ${p.callToAction}

Genera el guión completo listo para grabar, con secciones claras. Incluye al final 2-3 líneas de notas de producción (formato, música, hashtags).`;
  return { system, user };
}

async function callOpenAI(
  apiKey: string,
  system: string,
  user: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI response missing content");
  }
  return content.trim();
}

const LOG_PREFIX = "[studio-ia-generate]";

const N8N_WEBHOOK_DEFAULT =
  "https://n8n-n8n.obmrlq.easypanel.host/webhook-test/generador-de-descripciones";

/** Reenvía el payload al webhook de n8n (evita CORS: el navegador no llama a n8n directamente). */
async function forwardToN8nWebhook(payload: unknown): Promise<{ ok: boolean; text?: string; error?: string }> {
  const webhookUrl = Deno.env.get("N8N_DESCRIPTION_WEBHOOK_URL") || N8N_WEBHOOK_DEFAULT;
  console.log(`${LOG_PREFIX} forwarding to n8n webhook: ${webhookUrl}`);
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log(`${LOG_PREFIX} n8n webhook responded status=${res.status}`);
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText || `n8n responded ${res.status}` };
  }
  let text = "";
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      const data = (await res.json()) as Record<string, unknown>;
      const t = typeof data?.text === "string" ? data.text : typeof data?.body === "string" ? data.body : "";
      if (t) text = t.trim();
    } catch {
      // ignore
    }
  }
  return { ok: true, text };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  let body: { type?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    console.error(`${LOG_PREFIX} Invalid JSON body`);
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const { type, payload } = body;
  if (!type || payload === undefined || typeof type !== "string") {
    return jsonResponse(400, { ok: false, error: "type and payload are required" });
  }

  const isWebhookForward = type === "vehicle_description_webhook";
  if (!isWebhookForward && type !== "vehicle_description" && type !== "reel_script") {
    return jsonResponse(400, {
      ok: false,
      error: "type must be vehicle_description, reel_script or vehicle_description_webhook",
    });
  }

  if (isWebhookForward) {
    console.log(`${LOG_PREFIX} request start type=vehicle_description_webhook`);
    try {
      const result = await forwardToN8nWebhook(payload);
      if (result.ok) {
        return jsonResponse(200, { ok: true, text: result.text ?? "" });
      }
      return jsonResponse(500, { ok: false, error: result.error ?? "n8n webhook error" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`${LOG_PREFIX} webhook forward error:`, message);
      return jsonResponse(500, { ok: false, error: message });
    }
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error(`${LOG_PREFIX} OPENAI_API_KEY no configurada`);
    return jsonResponse(503, {
      ok: false,
      error: "OPENAI_API_KEY no configurada. Configura el secret en Supabase (Edge Functions).",
    });
  }

  console.log(`${LOG_PREFIX} request start type=${type}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

  try {
    let text: string;
    if (type === "vehicle_description") {
      console.log(`${LOG_PREFIX} loading system prompt (vehicle_description)`);
      const baseSystem = await getSystemPrompt(supabase, "vehicle_description", (payload as VehicleDescriptionPayload).branch_id)
        ?? VEHICLE_DESCRIPTION_SYSTEM_PROMPT;
      const { system, user } = await buildVehicleDescriptionPrompt(
        payload as VehicleDescriptionPayload,
        supabase,
        baseSystem
      );
      console.log(`${LOG_PREFIX} calling OpenAI (vehicle_description)`);
      text = await callOpenAI(apiKey, system, user);
    } else {
      console.log(`${LOG_PREFIX} loading system prompt (reel_script)`);
      const baseSystem = await getSystemPrompt(supabase, "reel_script", (payload as ReelScriptPayload).branch_id)
        ?? REEL_SCRIPT_DEFAULT_SYSTEM;
      const { system, user } = buildReelScriptPrompt(payload as ReelScriptPayload, baseSystem);
      console.log(`${LOG_PREFIX} calling OpenAI (reel_script)`);
      text = await callOpenAI(apiKey, system, user);
    }
    console.log(`${LOG_PREFIX} success type=${type}`);
    return jsonResponse(200, { ok: true, text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(`${LOG_PREFIX} error:`, message);
    return jsonResponse(500, { ok: false, error: message });
  }
}
