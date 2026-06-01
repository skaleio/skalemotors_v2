import { supabase } from "../supabase";

const DEFAULT_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function parseFunctionError(error: unknown): Promise<string> {
  if (!error || typeof error !== "object") {
    return "No se pudo contactar al servidor. Intenta de nuevo.";
  }

  const maybeHttp = error as { context?: { json?: () => Promise<unknown> }; message?: string };
  if (typeof maybeHttp.context?.json === "function") {
    try {
      const body = (await withTimeout(
        maybeHttp.context.json(),
        3_000,
        "timeout parsing error body",
      )) as { error?: string; message?: string; ok?: boolean };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      /* ignore */
    }
  }

  if (typeof maybeHttp.message === "string" && maybeHttp.message.trim()) {
    return maybeHttp.message;
  }

  return "No se pudo contactar al servidor. Intenta de nuevo.";
}

export async function invokeZernioFunction<T extends { ok?: boolean; error?: string }>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let data: T | null = null;
  let invokeError: unknown = null;

  try {
    const result = await withTimeout(
      supabase.functions.invoke<T>(functionName, { body }),
      timeoutMs,
      "Tiempo de espera agotado. Si estás en Vercel, confirma ALLOWED_ORIGINS en Supabase.",
    );
    data = result.data;
    invokeError = result.error;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Error de conexión");
  }

  if (data && typeof data === "object") {
    if (data.ok === false) {
      throw new Error(data.error ?? "Error en el servidor");
    }
    return data;
  }

  if (invokeError) {
    throw new Error(await parseFunctionError(invokeError));
  }

  throw new Error("Respuesta vacía del servidor");
}
