import { describe, expect, it } from "vitest";
import { hasPermission, isFinancePermission } from "./rbac";

describe("rbac permissions", () => {
  it("permite finanzas para admin", () => {
    expect(hasPermission("admin", "finance:read")).toBe(true);
    expect(hasPermission("admin", "finance:write")).toBe(true);
  });

  it("bloquea finanzas para vendedor", () => {
    expect(hasPermission("vendedor", "finance:read")).toBe(false);
  });

  it("jefe_jefe tiene finanzas completas (rol SaaS)", () => {
    expect(hasPermission("jefe_jefe", "finance:write")).toBe(true);
    expect(hasPermission("jefe_sucursal", "finance:read")).toBe(false);
  });

  it("isFinancePermission identifica permisos del módulo Finanzas", () => {
    expect(isFinancePermission("finance:read")).toBe(true);
    expect(isFinancePermission("finance:write")).toBe(true);
    expect(isFinancePermission("inventory:read")).toBe(false);
    expect(isFinancePermission(undefined)).toBe(false);
  });
});
