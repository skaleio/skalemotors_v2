import { describe, expect, it } from "vitest";
import {
  canViewInventoryPrice,
  hidesInventoryCosts,
  hidesInventoryFinancials,
  isPathBlockedForPhotographer,
  postAuthHomeForRole,
} from "./appRoles";

describe("appRoles", () => {
  it("redirige fotografo a consignaciones y vendedor a inicio comercial", () => {
    expect(postAuthHomeForRole("fotografo")).toBe("/app/consignaciones");
    expect(postAuthHomeForRole("vendedor")).toBe("/app");
    expect(postAuthHomeForRole("jefe_sucursal")).toBe("/app");
  });

  it("oculta precio solo para vendedor; fotografo puede ver precio", () => {
    expect(hidesInventoryFinancials("fotografo")).toBe(false);
    expect(hidesInventoryFinancials("vendedor")).toBe(true);
    expect(hidesInventoryFinancials("gerente")).toBe(false);
  });

  it("bloquea rutas de CRM para fotografo", () => {
    expect(isPathBlockedForPhotographer("/app/crm")).toBe(true);
    expect(isPathBlockedForPhotographer("/app/consignaciones")).toBe(false);
    expect(isPathBlockedForPhotographer("/app/mis-tareas")).toBe(false);
    expect(isPathBlockedForPhotographer("/app/website")).toBe(false);
  });

  it("fotografo ve precio pero no costo/margen", () => {
    expect(canViewInventoryPrice("fotografo")).toBe(true);
    expect(hidesInventoryCosts("fotografo")).toBe(true);
  });
});
