import { describe, expect, it } from "vitest";
import {
  filterAppointmentsForCalendarView,
  isAppointmentCalendarQueryEnabled,
  resolveAppointmentCalendarScope,
  resolveAppointmentSupervisionVendorScope,
  resolveSupervisedAppointmentQueryFilters,
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

describe("resolveAppointmentSupervisionVendorScope", () => {
  it("admin lista vendedores de todo el tenant", () => {
    const scope = resolveAppointmentSupervisionVendorScope({
      role: "admin",
      id: "admin-1",
      tenant_id: "t1",
      branch_id: "b1",
    });
    expect(scope).toEqual({
      tenantId: "t1",
      scope: "tenant",
      roles: ["vendedor"],
    });
  });

  it("gerente usa alcance de equipo (my_team)", () => {
    const scope = resolveAppointmentSupervisionVendorScope({
      role: "gerente",
      id: "g1",
      tenant_id: "t1",
      branch_id: "b1",
    });
    expect(scope?.scope).toBe("my_team");
    expect(scope?.teamOwnerUserId).toBe("g1");
    expect(scope?.roles).toEqual(["vendedor"]);
  });

  it("vendedor no puede supervisar", () => {
    expect(
      resolveAppointmentSupervisionVendorScope({
        role: "vendedor",
        id: "v1",
        tenant_id: "t1",
      }),
    ).toBeNull();
  });
});

describe("resolveSupervisedAppointmentQueryFilters", () => {
  const tenantScope = resolveAppointmentCalendarScope({
    role: "admin",
    id: "a1",
    tenant_id: "t1",
    branch_id: "b1",
  });

  it("con vendedor válido filtra solo por user_id", () => {
    expect(
      resolveSupervisedAppointmentQueryFilters(tenantScope, "vend-2", ["vend-1", "vend-2"]),
    ).toEqual({ userId: "vend-2" });
  });

  it("ignora vendedor no permitido y mantiene vista global", () => {
    expect(
      resolveSupervisedAppointmentQueryFilters(tenantScope, "hacker", ["vend-1"]),
    ).toEqual({ tenantId: "t1" });
  });
});

describe("filterAppointmentsForCalendarView", () => {
  it("excluye otro tenant y citas de otros vendedores al supervisar", () => {
    const rows = [
      { id: "1", tenant_id: "t1", user_id: "v1" },
      { id: "2", tenant_id: "t2", user_id: "v1" },
      { id: "3", tenant_id: "t1", user_id: "v2" },
    ];
    expect(filterAppointmentsForCalendarView(rows, "t1", "v1")).toEqual([
      { id: "1", tenant_id: "t1", user_id: "v1" },
    ]);
  });
});
