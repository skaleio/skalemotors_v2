import { describe, expect, it } from "vitest";
import {
  MFA_ENROLLMENT_MANDATORY,
  MFA_GATE_ENABLED,
  MFA_REQUIRED_ROLES,
  roleRequiresMfa,
} from "./mfaPolicy";

describe("mfaPolicy", () => {
  it("exige MFA para roles privilegiados solo con gate y enroll obligatorio activos", () => {
    const expected = MFA_GATE_ENABLED && MFA_ENROLLMENT_MANDATORY;
    for (const role of MFA_REQUIRED_ROLES) {
      expect(roleRequiresMfa(role)).toBe(expected);
    }
  });

  it("no exige MFA para vendedor", () => {
    expect(roleRequiresMfa("vendedor")).toBe(false);
  });
});
