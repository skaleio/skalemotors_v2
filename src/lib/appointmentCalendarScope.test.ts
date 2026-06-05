import { describe, expect, it } from "vitest";
import {
  isAppointmentCalendarQueryEnabled,
  resolveAppointmentCalendarScope,
} from "./appointmentCalendarScope";

describe("resolveAppointmentCalendarScope", () => {
  it("admin ve calendario del tenant", () => {
    const scope = resolveAppointmentCalendarScope({
      role: "admin",
      id: "u1",
      tenant_id: "t1",
      branch_id: "b1",
    });
    expect(scope).toEqual({
      scope: "tenant",
      tenantId: "t1",
      listDescription: "Calendario de la automotora",
    });
    expect(isAppointmentCalendarQueryEnabled(scope)).toBe(true);
  });

  it("gerente ve calendario de sucursal", () => {
    const scope = resolveAppointmentCalendarScope({
      role: "gerente",
      id: "u2",
      tenant_id: "t1",
      branch_id: "b2",
    });
    expect(scope?.scope).toBe("branch");
    expect(scope?.branchId).toBe("b2");
    expect(isAppointmentCalendarQueryEnabled(scope)).toBe(true);
  });

  it("vendedor ve solo sus citas", () => {
    const scope = resolveAppointmentCalendarScope({
      role: "vendedor",
      id: "u3",
      tenant_id: "t1",
      branch_id: "b1",
    });
    expect(scope?.scope).toBe("self");
    expect(scope?.userId).toBe("u3");
  });

  it("fotógrafo no tiene alcance de calendario", () => {
    const scope = resolveAppointmentCalendarScope({
      role: "fotografo",
      id: "u4",
      tenant_id: "t1",
    });
    expect(scope).toBeNull();
    expect(isAppointmentCalendarQueryEnabled(scope)).toBe(false);
  });
});
