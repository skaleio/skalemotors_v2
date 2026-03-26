import { captureEdgeException } from "./sentryEdge.ts";

export type ObservabilityContext = {
  tenant_id?: string | null;
  user_id?: string | null;
  role?: string | null;
  module?: string;
};

export function captureEdgeError(error: unknown, context: ObservabilityContext) {
  const err = error instanceof Error ? error : new Error(String(error));
  const line = JSON.stringify({
    level: "error",
    message: err.message,
    stack: err.stack,
    ...context,
    ts: new Date().toISOString(),
  });
  console.error(line);

  captureEdgeException(err, {
    tenant_id: context.tenant_id ?? undefined,
    user_id: context.user_id ?? undefined,
    role: context.role ?? undefined,
    module: context.module ?? undefined,
  });
}
