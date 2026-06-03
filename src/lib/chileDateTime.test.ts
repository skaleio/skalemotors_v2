import { describe, expect, it } from "vitest";

import { chileLocalToUtcIso } from "./chileDateTime";

describe("chileLocalToUtcIso", () => {
  it("convierte 2026-06-04 10:00 Chile a UTC", () => {
    const iso = chileLocalToUtcIso("2026-06-04", "10:00");
    expect(iso).toBeTruthy();
    const back = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(iso!));
    const parts = Object.fromEntries(back.map((p) => [p.type, p.value]));
    expect(parts.year).toBe("2026");
    expect(parts.month).toBe("06");
    expect(parts.day).toBe("04");
    expect(parts.hour).toBe("10");
    expect(parts.minute).toBe("00");
  });
});
