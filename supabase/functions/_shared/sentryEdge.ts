/**
 * Sentry en Edge (Deno). Secret opcional: SENTRY_DSN en Supabase → Edge Functions.
 * Si no hay DSN, no se carga el SDK (cero overhead).
 */
import * as Sentry from "npm:@sentry/deno@10.45.0";

let initialized = false;

function initSentryEdge() {
  if (initialized) return;
  const dsn = Deno.env.get("SENTRY_DSN") ?? Deno.env.get("EDGE_SENTRY_DSN");
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "edge",
    tracesSampleRate: Number(Deno.env.get("SENTRY_TRACES_SAMPLE_RATE") ?? "0.1"),
  });
  initialized = true;
}

export function captureEdgeException(error: unknown, tags: Record<string, string | undefined>) {
  const err = error instanceof Error ? error : new Error(String(error));
  initSentryEdge();
  const dsn = Deno.env.get("SENTRY_DSN") ?? Deno.env.get("EDGE_SENTRY_DSN");
  if (!dsn) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(tags)) {
      if (v != null && v !== "") scope.setTag(k, v);
    }
    Sentry.captureException(err);
  });
}
