import { describe, expect, it } from "vitest";
import { MFA_REQUIRED_ROLES, roleRequiresMfa } from "./mfaPolicy";

describe("mfaPolicy", () => {
  it("exige MFA para roles privilegiados", () => {
    for (const role of MFA_REQUIRED_ROLES) {
      expect(roleRequiresMfa(role)).toBe(true);
    }
  });

  it("no exige MFA para vendedor", () => {
    expect(roleRequiresMfa("vendedor")).toBe(false);
  });
});
