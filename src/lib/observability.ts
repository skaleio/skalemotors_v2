import * as Sentry from "@sentry/react";

interface UserScope {
  id?: string;
  email?: string;
  role?: string;
  tenantId?: string;
}

export function initObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_APP_ENV as string) || "development",
    enableLogs: true,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: true,
      }),
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.02,
    replaysOnErrorSampleRate: 1.0,
  });
}

export function setObservabilityUserContext(user: UserScope) {
  Sentry.setUser({ id: user.id, email: user.email });
  Sentry.setTags({
    role: user.role ?? "unknown",
    tenant_id: user.tenantId ?? "unknown",
  });
}

export function captureAppError(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}
