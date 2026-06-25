import { describe, it, expect } from "vitest";
import {
  parsePrecio,
  parseAnio,
  parseKilometros,
  summarizeListings,
  type RawListing,
} from "../../supabase/functions/getapi-appraisal/market";

describe("parsePrecio", () => {
  it("extrae dígitos de texto con formato chileno", () => {
    expect(parsePrecio("$ 12.990.000")).toBe(12990000);
    expect(parsePrecio("12990000")).toBe(12990000);
  });
  it("devuelve null para vacío o cero", () => {
    expect(parsePrecio(null)).toBeNull();
    expect(parsePrecio("")).toBeNull();
    expect(parsePrecio("0")).toBeNull();
    expect(parsePrecio("Consultar")).toBeNull();
  });
});

describe("parseAnio", () => {
  it("toma el año del modelo desde el título", () => {
    expect(parseAnio("Toyota Yaris 1.5 2019", 2026)).toBe(2019);
    expect(parseAnio("Mazda 3 Sport 2020 Full", 2026)).toBe(2020);
  });
  it("ignora números que no son años plausibles", () => {
    expect(parseAnio("Hyundai Grand i10 2021", 2026)).toBe(2021);
    expect(parseAnio("Kia Morning sin año", 2026)).toBeNull();
    expect(parseAnio("Auto 1899", 2026)).toBeNull();
  });
});

describe("parseKilometros", () => {
  it("extrae km de los detalles", () => {
    expect(parseKilometros(["Automática", "45.000 km", "Bencina"])).toBe(45000);
    expect(parseKilometros(["120000 Km"])).toBe(120000);
  });
  it("devuelve null si no hay km", () => {
    expect(parseKilometros(["Automática", "Bencina"])).toBeNull();
  });
});

describe("summarizeListings", () => {
  const base: RawListing[] = [
    { precioRaw: "10000000", titulo: "Toyota Corolla 2018", detalles: ["50.000 km"], url: "a" },
    { precioRaw: "12000000", titulo: "Toyota Corolla 2019", detalles: ["40.000 km"], url: "b" },
    { precioRaw: "14000000", titulo: "Toyota Corolla 2020", detalles: ["30.000 km"], url: "c" },
    { precioRaw: "30000000", titulo: "Toyota Corolla 2024", detalles: ["5.000 km"], url: "d" },
    { precioRaw: "Consultar", titulo: "Toyota Corolla 2019", detalles: [], url: "e" },
  ];

  it("filtra por año ±2 y calcula estadísticas", () => {
    const r = summarizeListings(base, 2019, 2026, 2);
    // 2018, 2019, 2020 entran; 2024 fuera de rango; "Consultar" sin precio
    expect(r.total_muestras).toBe(3);
    expect(r.precio_minimo).toBe(10000000);
    expect(r.precio_maximo).toBe(14000000);
    expect(r.precio_promedio).toBe(12000000);
    expect(r.precio_mediana).toBe(12000000);
    expect(r.confianza).toBe("baja");
  });

  it("sin targetYear conserva todos los que tienen precio", () => {
    const r = summarizeListings(base, null, 2026, 2);
    expect(r.total_muestras).toBe(4);
  });

  it("devuelve cero muestras cuando no hay anuncios válidos", () => {
    const r = summarizeListings([], 2019, 2026, 2);
    expect(r.total_muestras).toBe(0);
    expect(r.precio_promedio).toBe(0);
    expect(r.confianza).toBe("baja");
  });

  it("clasifica confianza alta con 8+ muestras", () => {
    const many: RawListing[] = Array.from({ length: 9 }, (_, i) => ({
      precioRaw: String(10000000 + i * 100000),
      titulo: "Toyota Corolla 2019",
      detalles: ["40.000 km"],
      url: String(i),
    }));
    expect(summarizeListings(many, 2019, 2026, 2).confianza).toBe("alta");
  });
});
