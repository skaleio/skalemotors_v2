import { describe, expect, it } from "vitest";
import { formatIngestSummaryLabel, hasIngestSummary } from "./leadNotesLegacy";

describe("leadNotesLegacy", () => {
  it("detecta resumen de ingesta", () => {
    expect(hasIngestSummary("hola")).toBe(true);
    expect(hasIngestSummary("  ")).toBe(false);
    expect(hasIngestSummary(null)).toBe(false);
  });

  it("expone etiqueta de resumen n8n", () => {
    expect(formatIngestSummaryLabel()).toContain("WhatsApp");
  });
});
