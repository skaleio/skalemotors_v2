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

/**
 * Borra el tenant-context y los caches de perfil del logout.
 * Crítico: si no se limpia, en logout queda el tenant_id del usuario anterior
 * y un nuevo login en el mismo tab puede mezclar UI hasta que se rehidrate.
 */
/** Solo el puntero de tenant activo (p. ej. antes de un nuevo signIn). */
export function clearTenantContextStorageOnly() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // localStorage no disponible
  }
}

/** Logout / cambio de cuenta: tenant + caches de perfil (evita mezcla cross-tenant). */
export function clearTenantContext() {
  if (typeof window === "undefined") return;
  try {
    clearTenantContextStorageOnly();
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("skale.user-profile")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // localStorage no disponible (modo privado, etc.)
  }
}

export function isLegacyProtectedUser(context: TenantContext): boolean {
  return Boolean(context.legacyProtected);
}
