// CORS helper para Edge Functions.
//
// En producción, setear el secret `ALLOWED_ORIGINS` en Supabase con la lista
// de orígenes separados por coma (ej: "https://app.skalemotors.cl,https://skalemotors.cl").
// Si no está seteado, mantiene el comportamiento legacy (wildcard).
//
// Uso recomendado en handlers:
//   const cors = getCorsHeaders(req);
//   ...new Response(..., { headers: { ...cors } });
//
// Compatibilidad: corsHeaders (constante con `*`) se mantiene para no romper
// las funciones existentes hasta que se migren una a una.

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-api-key, x-webhook-token, x-signature, x-hub-signature-256, idempotency-key";
const ALLOWED_METHODS = "GET,POST,OPTIONS";
const MAX_AGE = "86400";

function getAllowedOrigins(): string[] | null {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return null;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = getAllowedOrigins();
  let allowOrigin = "*";
  if (allowed && allowed.length > 0) {
    allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Max-Age": MAX_AGE,
  };
}

// Constante compartida. Si `ALLOWED_ORIGINS` está seteado en Supabase Secrets,
// usa el primer origen permitido (lockdown CORS). Si no, fallback a `*` (legacy).
// Para validación per-request real (multi-origen con echo del origen del request),
// usar getCorsHeaders(req).
function resolveDefaultAllowOrigin(): string {
  const allowed = getAllowedOrigins();
  if (allowed && allowed.length > 0) return allowed[0];
  return "*";
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": resolveDefaultAllowOrigin(),
  "Vary": "Origin",
  "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  "Access-Control-Allow-Methods": ALLOWED_METHODS,
  "Access-Control-Max-Age": MAX_AGE,
};
