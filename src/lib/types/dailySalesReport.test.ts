import { describe, expect, it } from "vitest";

import {
  chileDayKey,
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
    expect(p.social_posts.length).toBeGreaterThanOrEqual(4);
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

  it("chileDayKey mapea un timestamp UTC al día calendario en hora Chile", () => {
    // 03:00 UTC del 16-06 = 23:00 del 15-06 en Chile (UTC-4): cuenta como día anterior.
    expect(chileDayKey("2026-06-16T03:00:00Z")).toBe("2026-06-15");
    // 12:00 UTC del 16-06 = 08:00 del 16-06 en Chile: mismo día.
    expect(chileDayKey("2026-06-16T12:00:00Z")).toBe("2026-06-16");
  });
});
