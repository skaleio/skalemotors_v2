import * as Sentry from "@sentry/react";
import { supabaseIntegration } from "@supabase/sentry-js-integration";
import { SupabaseClient } from "@supabase/supabase-js";

interface UserScope {
  id?: string;
  email?: string;
  role?: string;
  tenantId?: string;
}

function supabaseRestUrlPrefix(): string {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!raw) return "";
  return `${raw.replace(/\/$/, "")}/rest`;
}

export function initObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  const restPrefix = supabaseRestUrlPrefix();
  const release = (import.meta.env.VITE_APP_RELEASE as string | undefined) || undefined;

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_APP_ENV as string) || "development",
    release,
    enableLogs: true,
    integrations: [
      supabaseIntegration(SupabaseClient, Sentry, {
        tracing: true,
        breadcrumbs: true,
        errors: true,
      }),
      Sentry.browserTracingIntegration({
        shouldCreateSpanForRequest: (url) => {
          if (!restPrefix) return true;
          return !url.startsWith(restPrefix);
        },
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        maskAllInputs: true,
      }),
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.02,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      "AbortError: The user aborted a request",
    ],
    denyUrls: [
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^safari-(web-)?extension:\/\//i,
      /extensions\//i,
    ],
  });
}

export function setObservabilityUserContext(user: UserScope) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser({ id: user.id, email: user.email });
  Sentry.setTags({
    role: user.role ?? "unknown",
    tenant_id: user.tenantId ?? "unknown",
  });
}

export function clearObservabilityUserContext() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser(null);
  Sentry.setTags({ role: "unknown", tenant_id: "unknown" });
}

export function captureAppError(error: unknown, context?: Record<string, unknown>) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureException(error, { extra: context });
}
