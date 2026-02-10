import { supabase } from "@/lib/supabase";

export type VehicleDescriptionPayload = {
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

export type ReelScriptPayload = {
  topic: string;
  platform: string;
  duration: string;
  style: string;
  hook?: string;
  keyPoints?: string;
  callToAction: string;
};

export type StudioIaGenerateResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * Genera una descripción de vehículo usando IA (Edge Function + OpenAI).
 * Si OPENAI_API_KEY no está configurada en Supabase, la función devuelve error.
 */
export async function generateVehicleDescription(
  payload: VehicleDescriptionPayload
): Promise<StudioIaGenerateResult> {
  const { data, error } = await supabase.functions.invoke("studio-ia-generate", {
    body: { type: "vehicle_description", payload },
  });

  if (error) {
    return { ok: false, error: error.message || "Error al conectar con el servicio" };
  }
  if (!data?.ok) {
    return { ok: false, error: (data?.error as string) || "Error al generar la descripción" };
  }
  if (typeof data?.text !== "string") {
    return { ok: false, error: "Respuesta inválida del servicio" };
  }
  return { ok: true, text: data.text };
}

/**
 * Genera un guión para reel usando IA (Edge Function + OpenAI).
 * Si OPENAI_API_KEY no está configurada en Supabase, la función devuelve error.
 */
export async function generateReelScript(
  payload: ReelScriptPayload
): Promise<StudioIaGenerateResult> {
  const { data, error } = await supabase.functions.invoke("studio-ia-generate", {
    body: { type: "reel_script", payload },
  });

  if (error) {
    return { ok: false, error: error.message || "Error al conectar con el servicio" };
  }
  if (!data?.ok) {
    return { ok: false, error: (data?.error as string) || "Error al generar el guión" };
  }
  if (typeof data?.text !== "string") {
    return { ok: false, error: "Respuesta inválida del servicio" };
  }
  return { ok: true, text: data.text };
}
