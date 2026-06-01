function envFalsey(name: string): boolean {
  const v = (import.meta.env[name] as string | undefined)?.trim().toLowerCase();
  return v === "false" || v === "0";
}

/**
 * Modo rápido en `npm run dev` (activo por defecto).
 * `VITE_AUTH_FAST_DEV=false` en .env reproduce timeouts/reintentos de producción en local.
 */
export function isFastAuthDev(): boolean {
  if (!import.meta.env.DEV) return false;
  return !envFalsey("VITE_AUTH_FAST_DEV");
}

export function getAuthTimings() {
  const fast = isFastAuthDev();
  return {
    profileFetchTimeoutMs: fast ? 5_000 : 20_000,
    profileNetworkRetries: fast ? 1 : 3,
    profileCacheTtlMs: fast ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000,
    signInTimeoutMs: fast ? 8_000 : 15_000,
    bootstrapTimeoutMs: fast ? 8_000 : 20_000,
    profileRetryBackoffMaxMs: fast ? 0 : 4_000,
    authLoadingTimeoutMs: fast ? 20_000 : 45_000,
  };
}
