import { describe, expect, it } from "vitest";
import { mapGlobalSearchResults } from "./useGlobalSearch";

describe("mapGlobalSearchResults", () => {
  it("mapea vehículos y leads a resultados de búsqueda global", () => {
    const results = mapGlobalSearchResults(
      [
        {
          id: "v1",
          vin: "ABC123",
          make: "Toyota",
          model: "Corolla",
          year: 2020,
          color: "Blanco",
          price: 10_000_000,
          status: "disponible",
          patente: "ABCD12",
        } as never,
      ],
      [
        {
          id: "l1",
          full_name: "Juan Pérez",
          email: "juan@test.cl",
          phone: "+56911112222",
          status: "nuevo",
        } as never,
      ],
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      type: "vehicle",
      highlightId: "v1",
      url: "/app/consignaciones",
    });
    expect(results[1]).toMatchObject({
      type: "lead",
      highlightId: "l1",
      url: "/app/leads?openLead=l1",
    });
  });
});
