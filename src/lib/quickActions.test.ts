import { describe, expect, it } from "vitest";
import { getQuickActionsForRole, isShortcutActionAvailable } from "./quickActions";

describe("quickActions", () => {
  it("admin ve finanzas y no incluye acciones sin ruta", () => {
    const labels = getQuickActionsForRole("admin").map((a) => a.id);
    expect(labels).toContain("finance");
    expect(labels).toContain("new_sale");
    expect(labels).not.toContain("quotes");
    expect(labels).not.toContain("billing");
    expect(labels).not.toContain("post_sale");
  });

  it("vendedor no ve finanzas ni dashboard principal", () => {
    const labels = getQuickActionsForRole("vendedor").map((a) => a.id);
    expect(labels).toContain("crm");
    expect(labels).toContain("new_lead");
    expect(labels).not.toContain("new_sale");
    expect(labels).not.toContain("finance");
  });

  it("fotógrafo ve álbumes e inventario", () => {
    const labels = getQuickActionsForRole("fotografo").map((a) => a.id);
    expect(labels).toContain("albums");
    expect(labels).toContain("photographer_tasks");
    expect(labels).not.toContain("crm");
  });

  it("atajos obsoletos no están disponibles", () => {
    expect(isShortcutActionAvailable("quotes" as never, "admin")).toBe(false);
    expect(isShortcutActionAvailable("billing" as never, "admin")).toBe(false);
    expect(isShortcutActionAvailable("new_lead", "vendedor")).toBe(true);
  });
});
