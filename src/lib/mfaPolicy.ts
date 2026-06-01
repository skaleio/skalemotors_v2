/** Roles que deben tener TOTP activo (Ley 19.628 + superficie admin). */
export const MFA_REQUIRED_ROLES = ["admin", "gerente", "jefe_jefe"] as const;

export type MfaRequiredRole = (typeof MFA_REQUIRED_ROLES)[number];

function envTruthy(name: string): boolean {
  const v = (import.meta.env[name] as string | undefined)?.trim().toLowerCase();
  return v === "true" || v === "1";
}

/** Modo investor-ready: activa gate + enroll obligatorio en un solo flag. */
const investorReadySecurity = envTruthy("VITE_FLAG_INVESTOR_READY_SECURITY");

/**
 * Gate MFA en login y rutas /app.
 * Producción: VITE_MFA_GATE_ENABLED=true o VITE_FLAG_INVESTOR_READY_SECURITY=true
 */
export const MFA_GATE_ENABLED =
  investorReadySecurity || envTruthy("VITE_MFA_GATE_ENABLED");

/** Enroll obligatorio por rol (solo aplica si MFA_GATE_ENABLED). */
export const MFA_ENROLLMENT_MANDATORY =
  investorReadySecurity || envTruthy("VITE_MFA_ENROLLMENT_MANDATORY");

export function roleRequiresMfa(role: string | undefined | null): boolean {
  if (!MFA_GATE_ENABLED || !MFA_ENROLLMENT_MANDATORY || !role) return false;
  return (MFA_REQUIRED_ROLES as readonly string[]).includes(role);
}
