import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface AIChatOptions {
  message: string;
  conversationHistory: ChatMessage[];
  branchId: string | null | undefined;
}

export interface AIGenerateOptions {
  tool: AITool;
  data: Record<string, unknown>;
  branchId?: string | null;
}

export type AITool =
  | "vehicle_description"
  | "sales_script"
  | "lead_response"
  | "monthly_summary"
  | "whatsapp_followup";

export type AIChatResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export type AIGenerateResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const INVOKE_TIMEOUT_MS = 120_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

function normalizeError(message: string): string {
  const m = message || "";
  if (/failed to send|edge function|fetch|network|ERR_FAILED|cors/i.test(m)) {
    return "No se pudo conectar con el asistente. Verifica que las Edge Functions ai-chat y ai-generate estén desplegadas y ANTHROPIC_API_KEY configurada en Supabase.";
  }
  if (/timeout|tiempo de espera/i.test(m)) {
    return "Tiempo de espera agotado. Intenta de nuevo.";
  }
  return m || "Error desconocido";
}

/**
 * Envía un mensaje al chat IA (datos del negocio). Usa Edge Function ai-chat con Anthropic.
 */
export async function sendChatMessage(options: AIChatOptions): Promise<string> {
  const { message, conversationHistory, branchId } = options;
  const history = conversationHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const invokePromise = supabase.functions.invoke<{ ok: boolean; text?: string; error?: string }>(
    "ai-chat",
    {
      body: {
        message: message.trim(),
        conversationHistory: history,
        branchId: branchId ?? null,
      },
    }
  );

  let data: { ok: boolean; text?: string; error?: string } | null = null;
  let error: { message?: string } | null = null;

  try {
    const result = await withTimeout(
      invokePromise,
      INVOKE_TIMEOUT_MS,
      "Tiempo de espera agotado"
    );
    error = result.error as { message?: string } | null;
    data = result.data as { ok: boolean; text?: string; error?: string } | null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de conexión";
    throw new Error(normalizeError(msg));
  }

  if (error) {
    throw new Error(normalizeError(error.message || "Error al enviar el mensaje"));
  }

  if (data?.ok === true && typeof data.text === "string") {
    return data.text;
  }

  throw new Error((data?.error as string) || "Error desconocido del asistente");
}

/**
 * Genera texto con una herramienta específica. Usa Edge Function ai-generate con Anthropic.
 */
export async function generateText(options: AIGenerateOptions): Promise<string> {
  const { tool, data, branchId } = options;

  const invokePromise = supabase.functions.invoke<{ ok: boolean; text?: string; error?: string }>(
    "ai-generate",
    {
      body: { tool, data, branchId: branchId ?? null },
    }
  );

  let resultData: { ok: boolean; text?: string; error?: string } | null = null;
  let invokeError: { message?: string } | null = null;

  try {
    const result = await withTimeout(
      invokePromise,
      INVOKE_TIMEOUT_MS,
      "Tiempo de espera agotado"
    );
    invokeError = result.error as { message?: string } | null;
    resultData = result.data as { ok: boolean; text?: string; error?: string } | null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de conexión";
    throw new Error(normalizeError(msg));
  }

  if (invokeError) {
    throw new Error(normalizeError(invokeError.message || "Error al generar"));
  }

  if (resultData?.ok === true && typeof resultData.text === "string") {
    return resultData.text;
  }

  throw new Error((resultData?.error as string) || "Error desconocido al generar");
}
