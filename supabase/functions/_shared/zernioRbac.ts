export type ZernioScope = "org" | "personal";

const ORG_CONNECT_ROLES = new Set(["admin", "gerente", "jefe_jefe"]);
// El fotógrafo publica en la cuenta de la automotora pero no la conecta/desconecta.
const ORG_PUBLISH_ROLES = new Set(["admin", "gerente", "jefe_jefe", "jefe_sucursal", "fotografo"]);

export function canConnectOrg(role: string | null | undefined): boolean {
  return !!role && ORG_CONNECT_ROLES.has(role);
}

export function canPublishOrg(role: string | null | undefined): boolean {
  return !!role && ORG_PUBLISH_ROLES.has(role);
}

export function canAccessScope(scope: ZernioScope, role: string | null | undefined): boolean {
  if (scope === "personal") return true;
  return canViewOrg(scope, role);
}

export function canViewOrg(_scope: ZernioScope, role: string | null | undefined): boolean {
  return canPublishOrg(role) || canConnectOrg(role);
}

export function canMutateOrgAccounts(role: string | null | undefined): boolean {
  return canConnectOrg(role);
}
