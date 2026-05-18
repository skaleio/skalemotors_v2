import { describe, expect, it } from "vitest";
import {
  MFA_ENROLLMENT_MANDATORY,
  MFA_REQUIRED_ROLES,
  roleRequiresMfa,
} from "./mfaPolicy";

describe("mfaPolicy", () => {
  it("exige MFA para roles privilegiados solo si el enroll obligatorio está activo", () => {
    for (const role of MFA_REQUIRED_ROLES) {
      expect(roleRequiresMfa(role)).toBe(MFA_ENROLLMENT_MANDATORY);
    }
  });

  it("no exige MFA para vendedor", () => {
    expect(roleRequiresMfa("vendedor")).toBe(false);
  });
});
