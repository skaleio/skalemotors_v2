export type FollowUpChannel = "llamada" | "whatsapp";

export const FOLLOW_UP_MIN_NOTE_LENGTH = 15;

export const FOLLOW_UP_CHANNEL_LABEL: Record<FollowUpChannel, string> = {
  llamada: "Llamadas",
  whatsapp: "WhatsApp",
};

/** Columna de contador en `leads` por canal. */
export const FOLLOW_UP_CHANNEL_FIELD: Record<FollowUpChannel, "calls_made" | "whatsapp_attempts"> = {
  llamada: "calls_made",
  whatsapp: "whatsapp_attempts",
};

/** Entradas sin contexto real que no deben contar como seguimiento. */
const GENERIC_NOTE_PHRASES = new Set([
  "ok",
  "okay",
  "oka",
  "listo",
  "hecho",
  "ya",
  "ya esta",
  "nada",
  "na",
  "n a",
  "llame",
  "lo llame",
  "llamado",
  "llamada",
  "llamo",
  "llame y nada",
  "wsp",
  "whatsapp",
  "wpp",
  "mensaje",
  "enviado",
  "mensaje enviado",
  "enviado mensaje",
  "sin respuesta",
  "no contesta",
  "no contesto",
  "no responde",
  "x",
  "xx",
  "test",
  "prueba",
  "asd",
]);

/** Minúsculas, sin acentos ni puntuación, espacios colapsados. */
function normalizeNote(body: string): string {
  return body
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ChannelNoteValidationInput {
  body: string;
  nextActionAt?: string | null;
}

export interface ChannelNoteValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Valida una nota de seguimiento por canal. Bloquea el guardado si la nota es
 * genérica o demasiado corta, o si falta la próxima acción con fecha.
 */
export function validateChannelNote(input: ChannelNoteValidationInput): ChannelNoteValidationResult {
  const errors: string[] = [];

  const body = (input.body ?? "").trim();
  const normalized = normalizeNote(body);
  const tooShort = normalized.length < FOLLOW_UP_MIN_NOTE_LENGTH;
  const isGeneric = normalized.length === 0 || GENERIC_NOTE_PHRASES.has(normalized);

  if (isGeneric || tooShort) {
    errors.push(
      `Escribe una nota con contexto real (qué ofreciste, qué conversaron, qué quedó pendiente). Mínimo ${FOLLOW_UP_MIN_NOTE_LENGTH} caracteres.`,
    );
  }

  const nextAction = (input.nextActionAt ?? "").trim();
  if (!nextAction) {
    errors.push("Indica la próxima acción con fecha.");
  }

  return { ok: errors.length === 0, errors };
}
