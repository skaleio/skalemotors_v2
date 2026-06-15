// Rate limiting compartido para Edge Functions.
//
// Respaldado por la tabla public.edge_rate_limits + RPC public.check_rate_limit
// (fixed-window). Requiere un cliente con service_role. Fail-open: si el RPC
// falla, NO bloquea el tráfico legítimo (la seguridad no debe romper el flujo).
//
// Uso:
//   const ip = getClientIp(req);
//   const limited = await enforceRateLimit(admin, {
//     identifier: ip, route: "vitrina-lead", max: 20, windowSeconds: 60,
//   }, cors);
//   if (limited) return limited;

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type RateLimitOptions = {
  identifier: string;
  route: string;
  max: number;
  windowSeconds: number;
};

/** Deriva la IP del cliente desde headers de proxy. Fallback estable si falta. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/**
 * Devuelve una Response 429 si se excedió el límite, o null si está permitido.
 * Fail-open ante errores del RPC.
 */
export async function enforceRateLimit(
  admin: SupabaseClient,
  opts: RateLimitOptions,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  try {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_identifier: opts.identifier,
      p_route: opts.route,
      p_max: opts.max,
      p_window_seconds: opts.windowSeconds,
    });
    if (error) return null; // fail-open
    const allowed = data !== false;
    if (allowed) return null;
  } catch {
    return null; // fail-open
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error: "Demasiadas solicitudes. Esperá un momento e intentá de nuevo.",
      code: "RATE_LIMITED",
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(opts.windowSeconds),
      },
    },
  );
}

/**
 * Batch limit: valida que un arreglo no exceda maxItems. Devuelve true si está
 * dentro del límite. Útil para endpoints que aceptan operaciones en lote.
 */
export function isWithinBatchLimit(value: unknown, maxItems: number): boolean {
  if (!Array.isArray(value)) return true;
  return value.length <= maxItems;
}
