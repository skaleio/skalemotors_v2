export type ZernioScope = "org" | "personal";

const ORG_CONNECT_ROLES = new Set(["admin", "gerente", "jefe_jefe"]);
const ORG_PUBLISH_ROLES = new Set(["admin", "gerente", "jefe_jefe", "jefe_sucursal"]);
const ORG_VIEW_ROLES = ORG_PUBLISH_ROLES;

export function canConnectOrg(role: string | undefined | null): boolean {
  return !!role && ORG_CONNECT_ROLES.has(role);
}

export function canPublishOrg(role: string | undefined | null): boolean {
  return !!role && ORG_PUBLISH_ROLES.has(role);
}

export function canViewOrgAccounts(role: string | undefined | null): boolean {
  return !!role && ORG_VIEW_ROLES.has(role);
}

export function canManagePersonalAccount(userId: string, authUserId: string): boolean {
  return userId === authUserId;
}

export function showOrgTab(role: string | undefined | null): boolean {
  return canViewOrgAccounts(role);
}
