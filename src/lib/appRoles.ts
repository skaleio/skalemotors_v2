/** Rol acotado: CRM y consignaciones comerciales. */
export const VENDOR_ROLE = "vendedor" as const;

/** Rol acotado: inventario (fotos + precios) y vitrina web. */
export const PHOTOGRAPHER_ROLE = "fotografo" as const;

export type FieldLimitedRole = typeof VENDOR_ROLE | typeof PHOTOGRAPHER_ROLE;

export function isVendorRole(role: string | undefined | null): boolean {
  return role === VENDOR_ROLE;
}

export function isPhotographerRole(role: string | undefined | null): boolean {
  return role === PHOTOGRAPHER_ROLE;
}

/** Oculta precios, márgenes y acciones financieras en inventario (solo vendedor). */
export function hidesInventoryFinancials(role: string | undefined | null): boolean {
  return isVendorRole(role);
}

/** Oculta costo y margen; el fotógrafo sí puede ver y editar precio de venta. */
export function hidesInventoryCosts(role: string | undefined | null): boolean {
  return isVendorRole(role) || isPhotographerRole(role);
}

export function canViewInventoryPrice(role: string | undefined | null): boolean {
  return isPhotographerRole(role) || !isVendorRole(role);
}

export function canAccessWebsiteForRole(role: string | undefined | null): boolean {
  return isPhotographerRole(role) || !isVendorRole(role);
}

/** Puede abrir el editor de vehículo para subir o actualizar fotos. */
export function canEditVehiclePhotos(role: string | undefined | null): boolean {
  return isPhotographerRole(role) || (!hidesInventoryFinancials(role) && !!role);
}

/** Roles con home comercial en `/app` (métricas personales + tareas + avisos). */
export const SALES_DASHBOARD_ROLES = new Set<string>([VENDOR_ROLE, "jefe_sucursal"]);

export function isSalesDashboardRole(role: string | undefined | null): boolean {
  return !!role && SALES_DASHBOARD_ROLES.has(role);
}

export function postAuthHomeForRole(role: string | undefined): string {
  if (isSalesDashboardRole(role)) return "/app";
  if (role === PHOTOGRAPHER_ROLE) return "/app/consignaciones";
  return "/app";
}

/** Rutas que el fotógrafo no debe usar (redirige a inventario). */
export const PHOTOGRAPHER_BLOCKED_PATH_PREFIXES = [
  "/app/crm",
  "/app/leads",
  "/app/whatsapp",
  "/app/appointments",
  "/app/tasks",
  "/app/ranking",
  "/app/sales",
  "/app/vendors",
  "/app/finance",
  "/app/fund-management",
  "/app/financial-tracking",
  "/app/financial-calculator",
  "/app/salary-distribution",
  "/app/billing",
  "/app/executive",
  "/app/documents",
  "/app/tasacion",
  "/app/integrations",
  "/app/users",
] as const;

/** Rutas visibles en sidebar pero bloqueadas para vendedor (solo admin/gerencia). */
export const VENDOR_LOCKED_PATH_PREFIXES = [
  "/app/whatsapp",
  "/app/redes-sociales",
] as const;

export function isPathLockedForVendor(pathname: string): boolean {
  const base = pathname.split("?")[0];
  return VENDOR_LOCKED_PATH_PREFIXES.some(
    (p) => base === p || base.startsWith(`${p}/`),
  );
}

export function isVendorSidebarItemLocked(
  url: string,
  role: string | undefined | null,
): boolean {
  if (!isVendorRole(role)) return false;
  const base = url.split("?")[0];
  return base === "/app/whatsapp" || base === "/app/redes-sociales";
}

export function isPathBlockedForPhotographer(pathname: string): boolean {
  const base = pathname.split("?")[0];
  if (base === "/app" || base === "/app/") return true;
  return PHOTOGRAPHER_BLOCKED_PATH_PREFIXES.some(
    (p) => base === p || base.startsWith(`${p}/`),
  );
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
  fotografo: "Fotógrafo",
  financiero: "Finanzas",
  servicio: "Servicio",
  inventario: "Inventario",
  jefe_jefe: "Jefe general",
  jefe_sucursal: "Jefe sucursal",
};
