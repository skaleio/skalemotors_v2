export interface TenantContext {
  tenantId?: string;
  role?: string;
  userId?: string;
  legacyProtected?: boolean;
}

const TENANT_STORAGE_KEY = "skale.tenant-context";

export function setTenantContext(context: TenantContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(context));
}

export function getTenantContext(): TenantContext {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(TENANT_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as TenantContext;
  } catch {
    return {};
  }
}

export function isLegacyProtectedUser(context: TenantContext): boolean {
  return Boolean(context.legacyProtected);
}
