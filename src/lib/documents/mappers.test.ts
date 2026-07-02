import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/types/database";
import {
  emptyConsignacionForm,
  mapConsignacionToForm,
  mapVehicleToConsignacionForm,
  type ConsignacionFormState,
} from "./mappers";

type Consignacion = Database["public"]["Tables"]["consignaciones"]["Row"];
type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

const consignacionBase = {
  id: "c-1",
  owner_name: "Juan Pérez",
  status: "nuevo",
  label: "sin_etiqueta",
  publicado: false,
  tenant_id: "t-1",
} as Consignacion;

const vehicleBase = {
  id: "v-1",
  make: "Toyota",
  model: "Yaris",
  year: 2021,
  vin: "VIN123",
  patente: "bcdf12",
  mileage: 45000,
  color: "Rojo",
  engine_number: "MOTOR-VEH-01",
  price: 9500000,
} as Vehicle;

/** Mismo merge que hace resolveConsignacionPrefill. */
function merged(c: Consignacion): ConsignacionFormState {
  const base = { ...emptyConsignacionForm(), ...mapVehicleToConsignacionForm(vehicleBase) };
  return { ...base, ...mapConsignacionToForm(c) } as ConsignacionFormState;
}

describe("mapConsignacionToForm", () => {
  it("no pisa los datos del vehículo cuando la consignación tiene campos vacíos", () => {
    const form = merged(consignacionBase);
    expect(form.vehicle_make).toBe("Toyota");
    expect(form.vehicle_model).toBe("Yaris");
    expect(form.vehicle_vin).toBe("VIN123");
    expect(form.vehicle_patente).toBe("BCDF12");
    expect(form.vehicle_km).toBe("45000");
    expect(form.vehicle_motor).toBe("MOTOR-VEH-01");
  });

  it("prioriza los datos de la consignación cuando existen", () => {
    const form = merged({
      ...consignacionBase,
      vehicle_make: "Hyundai",
      vehicle_model: "Accent",
      vehicle_vin: "VIN999",
      patente: "kdtr90",
      color: "Azul",
    } as Consignacion);
    expect(form.vehicle_make).toBe("Hyundai");
    expect(form.vehicle_model).toBe("Accent");
    expect(form.vehicle_vin).toBe("VIN999");
    expect(form.vehicle_chasis).toBe("VIN999");
    expect(form.vehicle_patente).toBe("KDTR90");
    expect(form.vehicle_color).toBe("Azul");
  });

  it("usa engine_number como N° de motor y nunca la cilindrada (motor)", () => {
    const conNumero = merged({
      ...consignacionBase,
      motor: "1.6",
      engine_number: "G4LC123456",
    } as Consignacion);
    expect(conNumero.vehicle_motor).toBe("G4LC123456");

    // Solo cilindrada: conserva el N° de motor del vehículo, no mete "1.6".
    const soloCilindrada = merged({ ...consignacionBase, motor: "1.6" } as Consignacion);
    expect(soloCilindrada.vehicle_motor).toBe("MOTOR-VEH-01");
  });

  it("mapea precios sugerido y mínimo desde la consignación", () => {
    const form = merged({
      ...consignacionBase,
      sale_price: 10000000,
      consignacion_price: 9000000,
    } as Consignacion);
    expect(form.sale_price).toBe("10000000");
    expect(form.min_sale_price).toBe("9000000");
  });
});
