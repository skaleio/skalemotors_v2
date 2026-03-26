import { describe, expect, it } from "vitest";
import { hasPermission } from "./rbac";

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
});
