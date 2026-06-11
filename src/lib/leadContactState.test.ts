import { describe, expect, it } from "vitest";
import {
  canAssignLeadContactState,
  shouldClearContactStateOnVendorExitNuevo,
  shouldShowLeadContactStateBadge,
} from "./leadContactState";

describe("leadContactState visibility", () => {
  const lead = { status: "nuevo" as const, contact_state: "prioridad" as const };

  it("vendedor ve etiqueta solo en Nuevo", () => {
    expect(shouldShowLeadContactStateBadge(lead, "vendedor")).toBe(true);
    expect(
      shouldShowLeadContactStateBadge({ ...lead, status: "en_seguimiento" }, "vendedor"),
    ).toBe(false);
  });

  it("admin siempre ve la etiqueta si existe", () => {
    expect(
      shouldShowLeadContactStateBadge({ ...lead, status: "en_seguimiento" }, "admin"),
    ).toBe(true);
  });

  it("vendedor puede calificar solo fuera de Nuevo", () => {
    expect(canAssignLeadContactState("vendedor", "nuevo")).toBe(false);
    expect(canAssignLeadContactState("vendedor", "en_seguimiento")).toBe(true);
    expect(canAssignLeadContactState("admin", "nuevo")).toBe(true);
  });

  it("limpia etiqueta cuando vendedor sale de Nuevo", () => {
    expect(
      shouldClearContactStateOnVendorExitNuevo("vendedor", "nuevo", "no_contesta"),
    ).toBe(true);
    expect(
      shouldClearContactStateOnVendorExitNuevo("admin", "nuevo", "no_contesta"),
    ).toBe(false);
    expect(
      shouldClearContactStateOnVendorExitNuevo("vendedor", "en_seguimiento", "negociando"),
    ).toBe(false);
  });
});
