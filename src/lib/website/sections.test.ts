import { describe, expect, it } from "vitest";

import {
  canAddSection,
  createSection,
  defaultSections,
  getAddSectionAvailability,
  getSectionAnchor,
  insertSectionAt,
  isSectionInNav,
  prepareSectionsForSave,
  validateSiteSections,
} from "./sections";
import { buildNavItems } from "./nav";

describe("getSectionAnchor", () => {
  it("usa anclas base cuando hay una sola sección por tipo", () => {
    const sections = defaultSections();
    const veh = sections.find((s) => s.type === "vehiculos")!;
    expect(getSectionAnchor(veh, sections)).toBe("stock");
  });

  it("genera anclas únicas si hay dos bloques de vehículos", () => {
    const a = createSection("vehiculos");
    const b = createSection("vehiculos");
    const sections = [a, b];
    const anchorA = getSectionAnchor(a, sections);
    const anchorB = getSectionAnchor(b, sections);
    expect(anchorA).not.toBe(anchorB);
    expect(anchorA.startsWith("stock")).toBe(true);
    expect(anchorB.startsWith("stock")).toBe(true);
  });
});

describe("getAddSectionAvailability", () => {
  it("solo permite una portada", () => {
    const sections = [createSection("hero")];
    expect(getAddSectionAvailability("hero", sections).allowed).toBe(false);
    expect(canAddSection("hero", sections)).toBe(false);
    expect(getAddSectionAvailability("vehiculos", sections).allowed).toBe(true);
  });
});

describe("validateSiteSections", () => {
  it("marca error si no hay secciones", () => {
    const issues = validateSiteSections([]);
    expect(issues.some((i) => i.code === "empty" && i.severity === "error")).toBe(true);
  });

  it("advierte si falta stock", () => {
    const issues = validateSiteSections([createSection("hero")]);
    expect(issues.some((i) => i.code === "no_stock")).toBe(true);
  });
});

describe("insertSectionAt", () => {
  it("inserta después del id indicado", () => {
    const hero = createSection("hero");
    const veh = createSection("vehiculos");
    const contact = createSection("contacto");
    const next = insertSectionAt([hero, contact], veh, { mode: "after", id: hero.id });
    expect(next.map((s) => s.type)).toEqual(["hero", "vehiculos", "contacto"]);
  });
});

describe("header menu", () => {
  it("consignaciones no entra al menú por defecto", () => {
    const block = createSection("consignaciones");
    expect(isSectionInNav(block)).toBe(false);
  });

  it("el usuario puede agregar una sección al menú", () => {
    const sections = [createSection("consignaciones")];
    expect(buildNavItems(sections)).toHaveLength(0);
    sections[0].showInNav = true;
    expect(buildNavItems(sections)).toHaveLength(1);
  });
});

describe("prepareSectionsForSave", () => {
  it("nunca devuelve array vacío", () => {
    const prepared = prepareSectionsForSave([]);
    expect(prepared.length).toBeGreaterThan(0);
  });
});
