import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

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
  mileage?: string;
  color?: string;
  price?: string;
  features?: string;
  tone: string;
  format: string;
};

type ReelScriptPayload = {
  topic: string;
  platform: string;
  duration: string;
  style: string;
  hook?: string;
  keyPoints?: string;
  callToAction: string;
};

function buildVehicleDescriptionPrompt(p: VehicleDescriptionPayload): { system: string; user: string } {
  const toneMap: Record<string, string> = {
    professional: "profesional y confiable",
    friendly: "amigable y cercano",
    persuasive: "persuasivo y orientado a la acción",
    technical: "técnico y detallado",
  };
  const formatMap: Record<string, string> = {
    portal: "portal web de venta de autos (texto para ficha del vehículo)",
    social: "post para redes sociales (Instagram/Facebook), con emojis y gancho",
    catalog: "catálogo o folleto impreso, más formal",
  };
  const system = `Eres un copywriter experto en automoción. Generas descripciones de vehículos en español, claras y atractivas, adaptadas al tono y formato que se indique. Responde ÚNICAMENTE con el texto de la descripción, sin títulos adicionales ni explicaciones.`;
  const user = `Genera una descripción para este vehículo:
- Marca: ${p.make}
- Modelo: ${p.model}
- Año: ${p.year}
${p.color ? `- Color: ${p.color}` : ""}
${p.mileage ? `- Kilometraje: ${p.mileage} km` : ""}
${p.price ? `- Precio: ${p.price} CLP` : ""}
- Tono: ${toneMap[p.tone] || p.tone}
- Formato: ${formatMap[p.format] || p.format}
${p.features?.trim() ? `Características a incluir (una por línea):\n${p.features}` : ""}

Genera solo el texto de la descripción, listo para copiar y pegar.`;
  return { system, user };
}

function buildReelScriptPrompt(p: ReelScriptPayload): { system: string; user: string } {
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
  const system = `Eres un guionista experto en contenido corto para redes sociales (reels, TikTok, shorts). Escribes en español, con ganchos fuertes en los primeros segundos y estructura clara: hook, contenido principal, CTA. Responde ÚNICAMENTE con el guión listo para usar, con secciones marcadas (HOOK, CONTENIDO, CTA) y notas breves de producción si aplica.`;
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return jsonResponse(503, {
      ok: false,
      error: "OPENAI_API_KEY no configurada. Configura el secret en Supabase (Edge Functions).",
    });
  }

  let body: { type?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const { type, payload } = body;
  if (!type || !payload || typeof type !== "string") {
    return jsonResponse(400, { ok: false, error: "type and payload are required" });
  }

  if (type !== "vehicle_description" && type !== "reel_script") {
    return jsonResponse(400, { ok: false, error: "type must be vehicle_description or reel_script" });
  }

  try {
    let text: string;
    if (type === "vehicle_description") {
      const { system, user } = buildVehicleDescriptionPrompt(payload as VehicleDescriptionPayload);
      text = await callOpenAI(apiKey, system, user);
    } else {
      const { system, user } = buildReelScriptPrompt(payload as ReelScriptPayload);
      text = await callOpenAI(apiKey, system, user);
    }
    return jsonResponse(200, { ok: true, text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse(500, { ok: false, error: message });
  }
}
