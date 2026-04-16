export type AppPermission =
  | "finance:read"
  | "finance:write"
  | "inventory:read"
  | "inventory:write"
  | "consignaciones:read"
  | "consignaciones:write"
  | "tramites:read"
  | "tramites:write"
  | "calendar:self"
  | "calendar:team"
  | "calendar:tenant";

const roleToPermissions: Record<string, AppPermission[]> = {
  /** Nivel 1 SaaS (alias de admin hasta migración de enum en DB) */
  jefe_jefe: [
    "finance:read",
    "finance:write",
    "inventory:read",
    "inventory:write",
    "consignaciones:read",
    "consignaciones:write",
    "tramites:read",
    "tramites:write",
    "calendar:tenant",
  ],
  /** Nivel 2 SaaS ≈ gerente de sucursal */
  jefe_sucursal: [
    "inventory:read",
    "inventory:write",
    "consignaciones:read",
    "consignaciones:write",
    "tramites:read",
    "tramites:write",
    "calendar:team",
  ],
  admin: [
    "finance:read",
    "finance:write",
    "inventory:read",
    "inventory:write",
    "consignaciones:read",
    "consignaciones:write",
    "tramites:read",
    "tramites:write",
    "calendar:tenant",
  ],
  financiero: ["finance:read", "finance:write", "calendar:team"],
  inventario: ["inventory:read", "inventory:write", "calendar:team"],
  gerente: [
    "inventory:read",
    "inventory:write",
    "consignaciones:read",
    "consignaciones:write",
    "tramites:read",
    "tramites:write",
    "calendar:team",
  ],
  vendedor: [
    "inventory:read",
    "consignaciones:read",
    "consignaciones:write",
    "tramites:read",
    "tramites:write",
    "calendar:self",
  ],
  servicio: ["tramites:read", "tramites:write", "calendar:team"],
};

export function hasPermission(role: string | undefined, permission: AppPermission): boolean {
  if (!role) return false;
  const permissions = roleToPermissions[role] ?? [];
  return permissions.includes(permission);
}

/** Permisos que cubren todo el módulo Finanzas de la app (rutas protegidas con estos). */
export function isFinancePermission(permission: AppPermission | undefined): boolean {
  return permission === "finance:read" || permission === "finance:write";
}
