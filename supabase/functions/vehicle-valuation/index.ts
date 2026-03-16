/// <reference path="../_shared/edge-runtime.d.ts" />
import { corsHeaders } from "../_shared/cors.ts";

type ValuationBody = {
  patente?: string;
  marca?: string;
  modelo?: string;
  año?: number;
  toleranciaAños?: number;
  usarIA?: boolean;
};

type VehicleData = {
  patente: string;
  marca: string;
  modelo: string;
  año: number;
  motor: string | null;
  combustible: string | null;
  transmision: string | null;
  fuente: string;
};

type AppraisalResult = {
  source?: string;
  tasacion?: {
    precio_minimo: number;
    precio_promedio: number;
    precio_maximo: number;
    precio_mediana: number;
    total_muestras: number;
    confianza: "alta" | "media" | "baja";
    fecha_consulta: string;
    tolerancia_años?: number;
  };
  muestras?: Array<{
    titulo: string;
    precio: number;
    año: number;
    kilometros: number | null;
    url: string;
  }>;
  uf_valor?: number;
  error?: string;
  blocked?: boolean;
};

type ClaudeValuation = {
  precio_estimado?: number;
  precio_minimo?: number;
  precio_maximo?: number;
  publicaciones_analizadas?: number;
  confianza?: "alta" | "media" | "baja";
  resumen?: string;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizePatente(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidChileanPatente(patente: string): boolean {
  return /^[A-Z]{4}\d{2}$/.test(patente);
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

async function callEdgeFunction(
  req: Request,
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      status: 500,
      error: "SUPABASE_URL o SUPABASE_ANON_KEY no están configuradas en la Edge Function.",
    };
  }

  const incomingAuth = req.headers.get("authorization");
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      ...(incomingAuth ? { Authorization: incomingAuth } : {}),
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const error =
      typeof parsed?.error === "string"
        ? parsed.error
        : `La función ${functionName} respondió con ${response.status}.`;
    return { ok: false, status: response.status, error };
  }

  return { ok: true, data: parsed ?? {} };
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function extractJsonFromText(input: string): string {
  const trimmed = input.trim();
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFence.slice(firstBrace, lastBrace + 1);
  }
  return withoutFence;
}

async function getValuationFromClaude(
  apiKey: string,
  vehicle: VehicleData,
  appraisal: Required<Pick<AppraisalResult, "muestras">>,
): Promise<ClaudeValuation> {
  const listings = appraisal.muestras.slice(0, 20);
  const prompt = `Eres un experto en valuacion de vehiculos usados en Chile.

Vehiculo a valuar:
- Marca: ${vehicle.marca}
- Modelo: ${vehicle.modelo}
- Ano: ${vehicle.año}
- Version: ${vehicle.motor ?? "no especificada"}

Publicaciones actuales (${listings.length} resultados):
${listings
  .map((l) => `- ${cleanText(l.titulo)} | $${Math.round(l.precio).toLocaleString("es-CL")} | ano ${l.año} | km ${l.kilometros ?? "n/d"}`)
  .join("\n")}

Responde SOLO con JSON valido:
{
  "precio_estimado": 12500000,
  "precio_minimo": 10000000,
  "precio_maximo": 15000000,
  "publicaciones_analizadas": 15,
  "confianza": "alta|media|baja",
  "resumen": "Breve explicacion del precio estimado"
}`;

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${err}`);
  }

  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data?.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Anthropic no devolvio contenido.");

  const jsonText = extractJsonFromText(text);
  return JSON.parse(jsonText) as ClaudeValuation;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Metodo no permitido" });
  }

  let body: ValuationBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Body JSON invalido" });
  }

  const patente = normalizePatente(body.patente ?? "");
  const toleranciaAños = Math.min(3, Math.max(1, Number(body.toleranciaAños) || 2));
  const usarIA = body.usarIA !== false;

  try {
    let vehicle: VehicleData | null = null;

    if (patente && isValidChileanPatente(patente)) {
      const lookup = await callEdgeFunction(req, "vehicle-lookup", { patente });
      if (lookup.ok) {
        const candidate = lookup.data as Partial<VehicleData> & { found?: boolean; error?: string };
        if (!candidate.found && candidate.marca && candidate.modelo && candidate.año) {
          vehicle = {
            patente: candidate.patente ?? patente,
            marca: cleanText(candidate.marca),
            modelo: cleanText(candidate.modelo),
            año: Number(candidate.año),
            motor: candidate.motor ?? null,
            combustible: candidate.combustible ?? null,
            transmision: candidate.transmision ?? null,
            fuente: candidate.fuente ?? "lookup",
          };
        }
      } else if (lookup.status === 401) {
        return jsonResponse(401, {
          ok: false,
          error: "Sesion expirada o no valida. Cierra sesion y vuelve a iniciar sesion.",
        });
      }
    }

    if (!vehicle) {
      const marca = cleanText(body.marca);
      const modelo = cleanText(body.modelo);
      const año = Number(body.año);
      if (!marca || !modelo || !Number.isFinite(año)) {
        return jsonResponse(400, {
          ok: false,
          error:
            "No se pudo resolver la patente automaticamente. Ingresa marca, modelo y ano manualmente para calcular la tasacion.",
        });
      }
      vehicle = {
        patente: patente || "SIN PATENTE",
        marca,
        modelo,
        año,
        motor: null,
        combustible: null,
        transmision: null,
        fuente: "manual",
      };
    }

    const appraisalCall = await callEdgeFunction(req, "vehicle-appraisal", {
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      año: vehicle.año,
      toleranciaAños,
    });

    if (!appraisalCall.ok) {
      return jsonResponse(appraisalCall.status, {
        ok: false,
        error: appraisalCall.error,
        vehicle,
      });
    }

    const appraisal = appraisalCall.data as AppraisalResult;
    if (!appraisal.tasacion || !Array.isArray(appraisal.muestras)) {
      return jsonResponse(200, {
        ok: false,
        error: appraisal.error ?? "No fue posible calcular la tasacion con comparables.",
        blocked: appraisal.blocked ?? false,
        vehicle,
      });
    }

    const finalTasacion = { ...appraisal.tasacion };
    let resumen: string | null = null;
    let aiUsed = false;
    let aiWarning: string | null = null;

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (usarIA && anthropicApiKey && appraisal.muestras.length > 0) {
      try {
        const ai = await getValuationFromClaude(anthropicApiKey, vehicle, { muestras: appraisal.muestras });
        const precioEstimado = safeNumber(ai.precio_estimado);
        const precioMinimo = safeNumber(ai.precio_minimo);
        const precioMaximo = safeNumber(ai.precio_maximo);

        if (precioEstimado && precioEstimado > 0) finalTasacion.precio_promedio = Math.round(precioEstimado);
        if (precioMinimo && precioMinimo > 0) finalTasacion.precio_minimo = Math.round(precioMinimo);
        if (precioMaximo && precioMaximo > 0) finalTasacion.precio_maximo = Math.round(precioMaximo);
        if (ai.confianza && ["alta", "media", "baja"].includes(ai.confianza)) {
          finalTasacion.confianza = ai.confianza;
        }
        if (typeof ai.resumen === "string" && ai.resumen.trim()) {
          resumen = ai.resumen.trim();
        }
        const publicaciones = safeNumber(ai.publicaciones_analizadas);
        if (publicaciones && publicaciones > 0) {
          finalTasacion.total_muestras = Math.min(appraisal.muestras.length, Math.round(publicaciones));
        }
        aiUsed = true;
      } catch (e) {
        aiWarning = e instanceof Error ? e.message : "No se pudo aplicar IA para refinar la tasacion.";
      }
    }

    return jsonResponse(200, {
      ok: true,
      vehicle,
      source: appraisal.source ?? "market",
      tasacion: finalTasacion,
      muestras: appraisal.muestras,
      uf_valor: appraisal.uf_valor ?? null,
      resumen,
      ai_used: aiUsed,
      ai_warning: aiWarning,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    console.error("[vehicle-valuation] error:", message);
    return jsonResponse(500, { ok: false, error: `No fue posible calcular la tasacion. ${message}` });
  }
});
