import { describe, expect, it } from "vitest";
import { normalizePatente } from "./patente";

describe("normalizePatente", () => {
  it("pasa a mayúsculas y quita separadores", () => {
    expect(normalizePatente("bcdf12")).toBe("BCDF12");
    expect(normalizePatente(" bc-df 12 ")).toBe("BCDF12");
    expect(normalizePatente("BC.DF.12")).toBe("BCDF12");
  });

  it("deja intacta una patente ya canónica", () => {
    expect(normalizePatente("BCDF12")).toBe("BCDF12");
    expect(normalizePatente("AB1234")).toBe("AB1234");
  });

  it("devuelve null cuando no queda nada", () => {
    expect(normalizePatente("")).toBeNull();
    expect(normalizePatente("   ")).toBeNull();
    expect(normalizePatente("--")).toBeNull();
    expect(normalizePatente(null)).toBeNull();
    expect(normalizePatente(undefined)).toBeNull();
  });
});
