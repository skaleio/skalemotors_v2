import { describe, it, expect } from "vitest";
import { canConnectOrg, canPublishOrg, canViewOrgAccounts, showOrgTab } from "./rbac";

describe("zernio rbac", () => {
  it("admin puede conectar y publicar org", () => {
    expect(canConnectOrg("admin")).toBe(true);
    expect(canPublishOrg("admin")).toBe(true);
    expect(showOrgTab("admin")).toBe(true);
  });

  it("jefe_sucursal puede publicar org pero no conectar", () => {
    expect(canConnectOrg("jefe_sucursal")).toBe(false);
    expect(canPublishOrg("jefe_sucursal")).toBe(true);
    expect(canViewOrgAccounts("jefe_sucursal")).toBe(true);
  });

  it("vendedor no accede a org", () => {
    expect(canConnectOrg("vendedor")).toBe(false);
    expect(canPublishOrg("vendedor")).toBe(false);
    expect(showOrgTab("vendedor")).toBe(false);
  });

  it("fotografo publica en org y ve la pestaña, pero no conecta", () => {
    expect(canConnectOrg("fotografo")).toBe(false);
    expect(canPublishOrg("fotografo")).toBe(true);
    expect(canViewOrgAccounts("fotografo")).toBe(true);
    expect(showOrgTab("fotografo")).toBe(true);
  });
});
