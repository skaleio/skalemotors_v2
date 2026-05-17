/** Roles que deben tener TOTP activo (Ley 19.628 + superficie admin). */
export const MFA_REQUIRED_ROLES = ["admin", "gerente", "jefe_jefe"] as const;

export type MfaRequiredRole = (typeof MFA_REQUIRED_ROLES)[number];

export function roleRequiresMfa(role: string | undefined | null): boolean {
  if (!role) return false;
  return (MFA_REQUIRED_ROLES as readonly string[]).includes(role);
}
