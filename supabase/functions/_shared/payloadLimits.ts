/** M5: límites de payload para funciones de IA y automatización. */
export const MAX_JSON_BODY_BYTES = 256 * 1024;
export const MAX_AI_USER_TEXT_CHARS = 32_000;

export async function readJsonBodyWithLimit(
  req: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  const len = req.headers.get("content-length");
  if (len) {
    const n = Number(len);
    if (Number.isFinite(n) && n > maxBytes) {
      return { ok: false, error: "Request body too large" };
    }
  }
  const raw = await req.text();
  if (raw.length > maxBytes) {
    return { ok: false, error: "Request body too large" };
  }
  if (!raw.trim()) {
    return { ok: false, error: "Empty body" };
  }
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

export function assertMaxTextField(
  value: unknown,
  fieldName: string,
  maxChars = MAX_AI_USER_TEXT_CHARS,
): string | null {
  if (value == null) return null;
  const s = String(value);
  if (s.length > maxChars) {
    throw new Error(`${fieldName} exceeds maximum length (${maxChars})`);
  }
  return s;
}
