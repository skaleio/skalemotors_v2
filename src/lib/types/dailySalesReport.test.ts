import { describe, expect, it } from "vitest";

import {
  chileTodayIsoDate,
  countDailyReportProgress,
  emptyDailySalesReportPayload,
  normalizeDailySalesReportPayload,
} from "@/lib/types/dailySalesReport";

describe("dailySalesReport", () => {
  it("genera payload mínimo con filas iniciales", () => {
    const p = emptyDailySalesReportPayload();
    expect(p.calls.length).toBeGreaterThanOrEqual(1);
    expect(p.credits.length).toBeGreaterThanOrEqual(1);
    expect(p.platform_uploads.length).toBeGreaterThanOrEqual(1);
  });

  it("normaliza payload parcial y agrega fila vacía al final si hay datos", () => {
    const p = normalizeDailySalesReportPayload({
      calls: [{ customer_name: "Juan", phone: "", vehicle: "", year: "", reason: "", result: "" }],
      daily_observations: "Cierre fuerte",
    });
    expect(p.calls[0].customer_name).toBe("Juan");
    expect(p.calls.length).toBeGreaterThanOrEqual(2);
    expect(p.daily_observations).toBe("Cierre fuerte");
  });

  it("cuenta progreso por secciones", () => {
    const p = emptyDailySalesReportPayload();
    p.calls[0].customer_name = "Ana";
    const prog = countDailyReportProgress(p);
    expect(prog.calls).toBe(1);
    expect(prog.sectionsFilled).toBe(1);
  });

  it("chileTodayIsoDate devuelve formato YYYY-MM-DD", () => {
    expect(chileTodayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
