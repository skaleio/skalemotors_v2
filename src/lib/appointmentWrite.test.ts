import { describe, expect, it } from "vitest";
import {
  buildAppointmentWritePayload,
  defaultAppointmentTimesForDay,
  formatAppointmentSaveError,
  resolveAppointmentAssigneeId,
  resolveAppointmentTimes,
  resolveWritableAppointmentId,
} from "./appointmentWrite";

describe("appointmentWrite", () => {
  it("usa 10:00–11:00 por defecto al elegir un día", () => {
    const day = new Date(2026, 5, 10);
    const { start, end } = defaultAppointmentTimesForDay(day);
    expect(start.getHours()).toBe(10);
    expect(end.getHours()).toBe(11);
  });

  it("vendedor siempre se asigna a sí mismo", () => {
    expect(
      resolveAppointmentAssigneeId({
        user: { id: "u1", role: "vendedor" },
        isVendor: true,
        canDelegate: false,
        formUserId: "other",
      }),
    ).toBe("u1");
  });

  it("gerente puede delegar al vendedor elegido", () => {
    expect(
      resolveAppointmentAssigneeId({
        user: { id: "g1", role: "gerente" },
        isVendor: false,
        canDelegate: true,
        formUserId: "seller-1",
      }),
    ).toBe("seller-1");
  });

  it("vendedor no puede actualizar cita de otro usuario", () => {
    expect(
      resolveWritableAppointmentId({
        existingId: "appt-1",
        existingOwnerUserId: "other",
        currentUserId: "me",
        isVendor: true,
      }),
    ).toBeNull();
  });

  it("exige tenant_id al armar payload", () => {
    expect(() =>
      buildAppointmentWritePayload({
        title: "Test",
        type: "meeting",
        status: "programada",
        start: new Date(),
        end: new Date(Date.now() + 3600000),
        assigneeId: "u1",
        tenantId: null,
      }),
    ).toThrow(/tenant/i);
  });

  it("traduce error RLS", () => {
    expect(
      formatAppointmentSaveError({ code: "42501", message: "new row violates row-level security" }),
    ).toMatch(/permiso/i);
  });

  it("corrige fin antes que inicio", () => {
    const day = new Date(2026, 5, 10);
    const { start, end } = resolveAppointmentTimes({
      day,
      startTimeStr: "16:00",
      endTimeStr: "15:00",
      fallbackStart: day,
      fallbackEnd: day,
    });
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
