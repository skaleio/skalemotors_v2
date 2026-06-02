import { describe, expect, it } from "vitest";

import { parseThemeCustom, serializeThemeCustom } from "./themeCustom";

describe("parseThemeCustom", () => {
  it("normaliza hex y descarta claves inválidas", () => {
    const parsed = parseThemeCustom({
      colorBg: "#abc",
      colorFg: "not-a-color",
      radius: "0.75rem",
      extra: "#fff",
    });
    expect(parsed.colorBg).toBe("#aabbcc");
    expect(parsed.colorFg).toBeUndefined();
    expect(parsed.radius).toBe("0.75rem");
  });
});

describe("serializeThemeCustom", () => {
  it("omite valores vacíos", () => {
    expect(serializeThemeCustom({ colorBg: "#ffffff" })).toEqual({ colorBg: "#ffffff" });
    expect(serializeThemeCustom({})).toEqual({});
  });
});
