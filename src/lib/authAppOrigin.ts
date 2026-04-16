/**
 * Origen público de la app para enlaces de Auth (p. ej. recuperación de contraseña).
 * En producción, define VITE_PUBLIC_APP_URL = https://tu-dominio.com (sin barra final)
 * y añade la misma URL en Supabase → Auth → Redirect URLs …/reset-password
 */
export function resolvePublicAppOrigin(overrides?: {
  envUrl?: string | null;
  windowOrigin?: string | null;
}): string {
  const fromEnv =
    overrides?.envUrl !== undefined
      ? overrides.envUrl
      : (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined);
  const trimmedEnv = fromEnv?.trim();
  if (trimmedEnv) return trimmedEnv.replace(/\/$/, "");

  const win =
    overrides?.windowOrigin !== undefined
      ? overrides.windowOrigin
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  return (win || "").replace(/\/$/, "");
}

export function passwordRecoveryRedirectUrl(overrides?: {
  envUrl?: string | null;
  windowOrigin?: string | null;
}): string {
  return `${resolvePublicAppOrigin(overrides)}/reset-password`;
}
