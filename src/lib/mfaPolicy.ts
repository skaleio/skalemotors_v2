/** Roles que deben tener TOTP activo (Ley 19.628 + superficie admin). */
export const MFA_REQUIRED_ROLES = ["admin", "gerente", "jefe_jefe"] as const;

export type MfaRequiredRole = (typeof MFA_REQUIRED_ROLES)[number];

/** Enroll obligatorio por rol. Poner en true cuando quieras reactivar el bloqueo. */
export const MFA_ENROLLMENT_MANDATORY = false;

export function roleRequiresMfa(role: string | undefined | null): boolean {
  if (!MFA_ENROLLMENT_MANDATORY || !role) return false;
  return (MFA_REQUIRED_ROLES as readonly string[]).includes(role);
}
