import { describe, expect, it } from "vitest";
import { getTenantContext, setTenantContext } from "./tenant";

describe("tenant context storage", () => {
  it("persist context in localStorage", () => {
    setTenantContext({ tenantId: "t1", role: "admin", userId: "u1", legacyProtected: true });
    const ctx = getTenantContext();
    expect(ctx.tenantId).toBe("t1");
    expect(ctx.legacyProtected).toBe(true);
  });
});
