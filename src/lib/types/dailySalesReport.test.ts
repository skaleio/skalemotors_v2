import { describe, expect, it } from "vitest";

import {
  chileTodayIsoDate,
  emptyDailySalesReportPayload,
  normalizeDailySalesReportPayload,
} from "@/lib/types/dailySalesReport";

describe("dailySalesReport", () => {
  it("genera payload con filas vacías por defecto", () => {
    const p = emptyDailySalesReportPayload();
    expect(p.calls).toHaveLength(6);
    expect(p.credits).toHaveLength(7);
    expect(p.platform_uploads).toHaveLength(5);
    expect(p.social_media.vehicles_posted).toHaveLength(5);
  });

  it("normaliza payload parcial sin perder estructura", () => {
    const p = normalizeDailySalesReportPayload({
      calls: [{ customer_name: "Juan" }],
      daily_observations: "Cierre fuerte",
    });
    expect(p.calls[0].customer_name).toBe("Juan");
    expect(p.calls[1].customer_name).toBe("");
    expect(p.daily_observations).toBe("Cierre fuerte");
  });

  it("chileTodayIsoDate devuelve formato YYYY-MM-DD", () => {
    expect(chileTodayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
