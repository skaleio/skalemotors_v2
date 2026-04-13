/**
 * Sentry en Edge (Deno). Secret opcional: SENTRY_DSN en Supabase → Edge Functions.
 * Si no hay DSN, no se carga el SDK (cero overhead).
 *
 * @see https://supabase.com/docs/guides/functions/examples/sentry-monitoring
 */
import * as Sentry from "npm:@sentry/deno@10.45.0";

let initialized = false;

function initSentryEdge() {
  if (initialized) return;
  const dsn = Deno.env.get("SENTRY_DSN") ?? Deno.env.get("EDGE_SENTRY_DSN");
  if (!dsn) return;
  const tracesSampleRate = Number(Deno.env.get("SENTRY_TRACES_SAMPLE_RATE") ?? "0.1");
  Sentry.init({
    dsn,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "edge",
    defaultIntegrations: false,
    tracesSampleRate,
    profilesSampleRate: tracesSampleRate > 0 ? Math.min(tracesSampleRate, 0.2) : 0,
  });
  const region = Deno.env.get("SB_REGION");
  if (region) Sentry.setTag("region", region);
  initialized = true;
}

export async function flushSentryEdge(timeoutMs = 2000): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN") ?? Deno.env.get("EDGE_SENTRY_DSN");
  if (!dsn) return;
  initSentryEdge();
  await Sentry.flush(timeoutMs);
}

export function captureEdgeException(error: unknown, tags: Record<string, string | undefined>) {
  const err = error instanceof Error ? error : new Error(String(error));
  initSentryEdge();
  const dsn = Deno.env.get("SENTRY_DSN") ?? Deno.env.get("EDGE_SENTRY_DSN");
  if (!dsn) return;
  Sentry.withScope((scope) => {
    const executionId = Deno.env.get("SB_EXECUTION_ID");
    if (executionId) scope.setTag("execution_id", executionId);
    for (const [k, v] of Object.entries(tags)) {
      if (v != null && v !== "") scope.setTag(k, v);
    }
    Sentry.captureException(err);
  });
}
