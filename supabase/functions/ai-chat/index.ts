/// <reference path="../_shared/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildBranchBrain } from "../_shared/brainBuilder.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_CHAT = 1024;
const TEMPERATURE_CHAT = 0.3;
const MAX_HISTORY = 10;
const BRAIN_MAX_AGE_MS = 15 * 60 * 1000; // 15 min: si el cerebro es más viejo, se reconstruye

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  message: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  feature?: string;
  branchId?: string | null;
};

function buildSystemPromptBase(branchName: string): string {
  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Eres un asistente especializado en gestión de automotoras para Skale Motors. La sucursal activa es: ${branchName || "General"}. Fecha actual: ${today}.

Reglas:
- Responde siempre en español (chileno), de forma profesional y concisa.
- Usa ÚNICAMENTE los datos del contexto que te proporciono. Si no hay dato para algo, dilo claramente.
- Para montos en pesos chilenos usa formato legible (ej. $1.500.000 o 1,5 millones).
- Sé breve en respuestas cortas; desarrolla más si preguntan análisis o detalle.`;
}

/**
 * Obtiene el cerebro de la sucursal: si existe y está fresco (< 15 min), lo devuelve;
 * si no, construye el snapshot completo, lo guarda en ai_branch_brain y lo devuelve.
 * Un cerebro por branch_id = todos los usuarios de esa sucursal comparten el mismo cerebro.
 */
async function getOrBuildBrain(
  supabase: ReturnType<typeof createClient>,
  branchId: string
): Promise<string> {
  const { data: row } = await supabase
    .from("ai_branch_brain")
    .select("snapshot_text, updated_at")
    .eq("branch_id", branchId)
    .maybeSingle();

  const now = Date.now();
  if (row?.snapshot_text && row?.updated_at) {
    const age = now - new Date(row.updated_at).getTime();
    if (age < BRAIN_MAX_AGE_MS) {
      return row.snapshot_text;
    }
  }

  const snapshotText = await buildBranchBrain(supabase, branchId);
  await supabase
    .from("ai_branch_brain")
    .upsert(
      {
        branch_id: branchId,
        snapshot_text: snapshotText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "branch_id" }
    );
  return snapshotText;
}

async function callAnthropic(
  apiKey: string,
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS_CHAT,
      temperature: TEMPERATURE_CHAT,
      system,
      messages,
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

  const { message, conversationHistory = [], branchId = null } = body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return jsonResponse(400, { ok: false, error: "message is required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(500, { ok: false, error: "Supabase no configurado" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let branchName = "General";
  if (branchId) {
    const { data: branch } = await supabase.from("branches").select("name").eq("id", branchId).maybeSingle();
    if (branch?.name) branchName = branch.name;
  }

  try {
    const context =
      branchId != null
        ? await getOrBuildBrain(supabase, branchId)
        : await buildBranchBrain(supabase, null);
    const systemBase = buildSystemPromptBase(branchName);
    const systemContent = systemBase + "\n\n" + context;

    const trimmedHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message.trim() },
    ];

    const text = await callAnthropic(apiKey, systemContent, messages);
    return jsonResponse(200, { ok: true, text });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.error("[ai-chat] error:", errMsg);
    return jsonResponse(500, { ok: false, error: errMsg });
  }
}
