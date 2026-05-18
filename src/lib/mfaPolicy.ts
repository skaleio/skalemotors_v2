/** Roles que deben tener TOTP activo (Ley 19.628 + superficie admin). */
export const MFA_REQUIRED_ROLES = ["admin", "gerente", "jefe_jefe"] as const;

export type MfaRequiredRole = (typeof MFA_REQUIRED_ROLES)[number];

/**
 * Gate MFA en login y rutas /app. false = email/password → dashboard sin pasos extra.
 * Reactivar: MFA_GATE_ENABLED=true y MFA_ENROLLMENT_MANDATORY=true si aplica enroll por rol.
 */
export const MFA_GATE_ENABLED = false;

/** Enroll obligatorio por rol (solo aplica si MFA_GATE_ENABLED). */
export const MFA_ENROLLMENT_MANDATORY = false;

export function roleRequiresMfa(role: string | undefined | null): boolean {
  if (!MFA_GATE_ENABLED || !MFA_ENROLLMENT_MANDATORY || !role) return false;
  return (MFA_REQUIRED_ROLES as readonly string[]).includes(role);
}
