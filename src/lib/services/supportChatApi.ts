import { supabase } from "@/lib/supabase";

export type SupportChatMessage = { role: "user" | "assistant"; content: string };

export type SupportChatResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const INVOKE_TIMEOUT_MS = 180_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

/**
 * Envía un mensaje al chat de soporte (cerebro del negocio).
 * La Edge Function obtiene métricas actuales y usa OpenAI para responder.
 */
export async function sendSupportChatMessage(
  message: string,
  branchId: string | null | undefined,
  history: SupportChatMessage[] = []
): Promise<SupportChatResult> {
  const body = {
    message: message.trim(),
    branchId: branchId ?? null,
    history: history.slice(-20),
  };

  const invokePromise = supabase.functions.invoke<{ ok: boolean; text?: string; error?: string }>("support-chat", {
    body,
  });

  let data: { ok: boolean; text?: string; error?: string } | null = null;
  let error: { message?: string } | null = null;

  try {
    const result = await withTimeout(
      invokePromise,
      INVOKE_TIMEOUT_MS,
      "Tiempo de espera agotado. Intenta de nuevo."
    );
    error = result.error as { message?: string } | null;
    data = result.data as { ok: boolean; text?: string; error?: string } | null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de conexión";
    if (/timeout|tiempo de espera/i.test(msg)) {
      return { ok: false, error: "La respuesta tardó más de 3 minutos. Si tu base de datos o Supabase están lentos, puede ocurrir. Intenta de nuevo; la segunda vez suele ser más rápida (función ya en memoria)." };
    }
    return { ok: false, error: "No se pudo conectar con el asistente. Verifica que la función support-chat esté desplegada y OPENAI_API_KEY en Secrets." };
  }

  if (error) {
    const msg = error.message || "Error al enviar el mensaje";
    if (/failed to send|edge function|fetch|network|ERR_FAILED|cors/i.test(msg)) {
      return {
        ok: false,
        error: "No se pudo conectar con la función. Despliega con: npx supabase functions deploy support-chat --no-verify-jwt (y asegúrate de tener OPENAI_API_KEY en Secrets).",
      };
    }
    return { ok: false, error: msg };
  }

  if (data?.ok === true && typeof data.text === "string") {
    return { ok: true, text: data.text };
  }

  return {
    ok: false,
    error: (data?.error as string) || "Error desconocido del asistente",
  };
}
