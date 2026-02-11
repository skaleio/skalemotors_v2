import { supabase } from "@/lib/supabase";

export type VehicleDescriptionPayload = {
  make: string;
  model: string;
  year: string;
  variant?: string;
  mileage?: string;
  engine?: string;
  power_cv?: string;
  torque_nm?: string;
  transmission?: string;
  price?: string;
  financiable_from?: string;
  color?: string;
  highlights?: string;
  features?: string;
  include_contact?: boolean;
  /** Opcional: sucursal para usar prompt específico de tienda (studio_prompts) */
  branch_id?: string | null;
};

export type ReelScriptPayload = {
  topic: string;
  platform: string;
  duration: string;
  style: string;
  hook?: string;
  keyPoints?: string;
  callToAction: string;
  /** Opcional: sucursal para usar prompt específico de tienda (studio_prompts) */
  branch_id?: string | null;
};

export type StudioIaGenerateResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/** Tiempo máximo de espera (cold start + OpenAI puede superar 60s). */
const INVOKE_TIMEOUT_MS = 95_000;

function normalizeInvokeError(message: string): string {
  const m = message || "";
  if (/failed to send|edge function|fetch|network/i.test(m) || m.includes("Edge Function")) {
    return "No se pudo conectar con Studio IA. Despliega la Edge Function 'studio-ia-generate' y configura OPENAI_API_KEY en Supabase (Secrets).";
  }
  if (/timeout|tiempo de espera/i.test(m)) {
    return "Tiempo de espera agotado. La IA tardó demasiado; intenta de nuevo o usa la plantilla local.";
  }
  return m || "Error al conectar con el servicio";
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

/**
 * Genera una descripción de vehículo usando IA (Edge Function + OpenAI).
 * Si OPENAI_API_KEY no está configurada en Supabase, la función devuelve error.
 */
export async function generateVehicleDescription(
  payload: VehicleDescriptionPayload
): Promise<StudioIaGenerateResult> {
  const invokePromise = supabase.functions.invoke("studio-ia-generate", {
    body: { type: "vehicle_description", payload },
  });

  let data: unknown;
  let error: { message?: string } | null = null;
  try {
    const result = await withTimeout(
      invokePromise,
      INVOKE_TIMEOUT_MS,
      "Tiempo de espera agotado"
    );
    data = result?.data;
    error = result?.error ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de conexión";
    return { ok: false, error: normalizeInvokeError(msg) };
  }

  if (error) {
    return { ok: false, error: normalizeInvokeError(error.message ?? "Error desconocido") };
  }
  const ok = (data as { ok?: boolean })?.ok;
  const text = (data as { text?: string })?.text;
  const errMsg = (data as { error?: string })?.error;
  if (!ok) {
    return { ok: false, error: (errMsg as string) || "Error al generar la descripción" };
  }
  if (typeof text !== "string") {
    return { ok: false, error: "Respuesta inválida del servicio" };
  }
  return { ok: true, text };
}

/**
 * Genera un guión para reel usando IA (Edge Function + OpenAI).
 * Si OPENAI_API_KEY no está configurada en Supabase, la función devuelve error.
 */
export async function generateReelScript(
  payload: ReelScriptPayload
): Promise<StudioIaGenerateResult> {
  const invokePromise = supabase.functions.invoke("studio-ia-generate", {
    body: { type: "reel_script", payload },
  });

  let data: unknown;
  let error: { message?: string } | null = null;
  try {
    const result = await withTimeout(
      invokePromise,
      INVOKE_TIMEOUT_MS,
      "Tiempo de espera agotado"
    );
    data = result?.data;
    error = result?.error ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de conexión";
    return { ok: false, error: normalizeInvokeError(msg) };
  }

  if (error) {
    return { ok: false, error: normalizeInvokeError(error.message ?? "Error desconocido") };
  }
  const ok = (data as { ok?: boolean })?.ok;
  const text = (data as { text?: string })?.text;
  const errMsg = (data as { error?: string })?.error;
  if (!ok) {
    return { ok: false, error: (errMsg as string) || "Error al generar el guión" };
  }
  if (typeof text !== "string") {
    return { ok: false, error: "Respuesta inválida del servicio" };
  }
  return { ok: true, text };
}
