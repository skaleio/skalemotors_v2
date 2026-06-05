import { describe, expect, it } from "vitest";
import { buildAppointmentDetailSnapshot } from "./appointmentDisplay";

describe("buildAppointmentDetailSnapshot", () => {
  it("arma detalle con relaciones y horario de fin por duración", () => {
    const detail = buildAppointmentDetailSnapshot({
      id: "apt-1",
      title: "Test Drive Toyota",
      type: "test_drive",
      status: "programada",
      scheduled_at: "2026-06-05T16:00:00.000Z",
      duration_minutes: 45,
      description: "Cliente interesado en financiamiento",
      lead: { full_name: "María López", phone: "+56911112222", email: "maria@example.com" },
      vehicle: { make: "Toyota", model: "Corolla", year: 2024 },
      branch: { name: "Sucursal Centro" },
      user: { full_name: "Pedro Vendedor", email: "pedro@example.com" },
    });

    expect(detail.title).toBe("Test Drive Toyota");
    expect(detail.typeLabel).toBe("Test Drive");
    expect(detail.statusLabel).toBe("Programada");
    expect(detail.clientName).toBe("María López");
    expect(detail.vehicleStr).toContain("Toyota Corolla");
    expect(detail.branchName).toBe("Sucursal Centro");
    expect(detail.assigneeName).toBe("Pedro Vendedor");
    expect(detail.notes).toContain("financiamiento");
    expect(new Date(detail.endAt).getTime()).toBeGreaterThan(new Date(detail.scheduledAt).getTime());
  });
});
