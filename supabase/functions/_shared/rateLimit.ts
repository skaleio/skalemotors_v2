import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type RateLimitOptions = {
  identifier: string;
  route: string;
  max: number;
  windowSeconds: number;
};

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
    if (error) return null;
    const allowed = data !== false;
    if (allowed) return null;
  } catch {
    return null;
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

export function isWithinBatchLimit(value: unknown, maxItems: number): boolean {
  if (!Array.isArray(value)) return true;
  return value.length <= maxItems;
}
