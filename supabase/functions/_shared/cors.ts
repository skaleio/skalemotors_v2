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

const corsBase = {
  Vary: "Origin",
  "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  "Access-Control-Allow-Methods": ALLOWED_METHODS,
  "Access-Control-Max-Age": "600",
} as const;

/** true si no hay lista de orígenes o el Origin del request está permitido */
export function isOriginAllowed(req: Request): boolean {
  const allowed = getAllowedOrigins();
  if (!allowed || allowed.length === 0) return true;
  const origin = req.headers.get("origin");
  // Sin Origin: llamadas servidor (p. ej. proxy Vercel /api/landing-booking → Edge).
  if (!origin) return true;
  return allowed.includes(origin);
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = getAllowedOrigins();

  if (!allowed || allowed.length === 0) {
    return {
      ...corsBase,
      "Access-Control-Allow-Origin": origin ?? "*",
    };
  }

  if (!origin || !allowed.includes(origin)) {
    // No devolver el primer origen de la lista: el browser bloquea el POST y parece timeout.
    return { ...corsBase };
  }

  return {
    ...corsBase,
    "Access-Control-Allow-Origin": origin,
  };
}

/**
 * CORS para endpoints PÚBLICOS y multi-dominio: las vitrinas de tenants viven en
 * dominios arbitrarios de clientes (miami-motors.vercel.app, dominios propios, etc.),
 * que no pueden estar en la allowlist ALLOWED_ORIGINS (esa es para la app admin).
 * Devuelve wildcard: es seguro porque estos endpoints no usan credenciales/cookies
 * y el tenant se resuelve server-side por hostname verificado, no por el Origin.
 */
export function getPublicCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Max-Age": MAX_AGE,
    Vary: "Accept-Encoding",
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
