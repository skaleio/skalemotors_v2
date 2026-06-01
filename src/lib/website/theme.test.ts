import { describe, expect, it } from "vitest";

import {
  FONT_PAIRS,
  THEME_PRESETS,
  buildTokens,
  googleFontsHref,
  isLuxuryTheme,
  readableFg,
  tokensToCssVars,
} from "./theme";

describe("readableFg", () => {
  it("devuelve blanco sobre fondo oscuro", () => {
    expect(readableFg("#0b0b0f")).toBe("#ffffff");
    expect(readableFg("#7c3aed")).toBe("#ffffff");
  });

  it("devuelve negro sobre fondo claro", () => {
    expect(readableFg("#ffffff")).toBe("#000000");
    expect(readableFg("#f5d90a")).toBe("#000000");
  });

  it("soporta hex de 3 dígitos y sin #", () => {
    expect(readableFg("000")).toBe("#ffffff");
    expect(readableFg("#fff")).toBe("#000000");
  });

  it("cae a blanco con color inválido", () => {
    expect(readableFg("no-es-color")).toBe("#ffffff");
  });
});

describe("buildTokens", () => {
  it("usa el preset del tema indicado", () => {
    const tokens = buildTokens({ theme: "premium" });
    expect(tokens.colorBg).toBe(THEME_PRESETS.premium.colorBg);
  });

  it("tema inválido o ausente cae a moderna y no lanza", () => {
    expect(buildTokens({ theme: "inexistente" }).colorBg).toBe(
      THEME_PRESETS.moderna.colorBg,
    );
    expect(buildTokens(null).colorBg).toBe(THEME_PRESETS.moderna.colorBg);
    expect(buildTokens(undefined).colorBg).toBe(THEME_PRESETS.moderna.colorBg);
  });

  it("aplica color primario de marca y recalcula su foreground", () => {
    const tokens = buildTokens({ theme: "moderna", primary_color: "#ffffff" });
    expect(tokens.colorPrimary).toBe("#ffffff");
    expect(tokens.colorPrimaryFg).toBe("#000000");
  });

  it("ignora color primario inválido y conserva el del tema", () => {
    const tokens = buildTokens({ theme: "moderna", primary_color: "rojo" });
    expect(tokens.colorPrimary).toBe(THEME_PRESETS.moderna.colorPrimary);
  });

  it("aplica color secundario de marca", () => {
    const tokens = buildTokens({ theme: "moderna", secondary_color: "#123456" });
    expect(tokens.colorSecondary).toBe("#123456");
  });

  it("usa el par de fuentes del tema por defecto", () => {
    const tokens = buildTokens({ theme: "tradicional" });
    expect(tokens.fontHeading).toBe(FONT_PAIRS["playfair-lora"].heading);
  });

  it("permite override de tipografía válida", () => {
    const tokens = buildTokens({ theme: "moderna", font: "space-inter" });
    expect(tokens.fontHeading).toBe(FONT_PAIRS["space-inter"].heading);
  });

  it("ignora tipografía inválida y cae al par del tema", () => {
    const tokens = buildTokens({ theme: "moderna", font: "comic-sans" });
    expect(tokens.fontHeading).toBe(FONT_PAIRS["poppins-inter"].heading);
  });
});

describe("tokensToCssVars", () => {
  it("expone las variables --sm-* clave", () => {
    const vars = tokensToCssVars(buildTokens({ theme: "moderna" }));
    expect(vars["--sm-primary"]).toBeDefined();
    expect(vars["--sm-font-heading"]).toBeDefined();
    expect(vars["--sm-radius"]).toBeDefined();
  });
});

describe("isLuxuryTheme", () => {
  it("miami y premium activan layout luxury", () => {
    expect(isLuxuryTheme("miami")).toBe(true);
    expect(isLuxuryTheme("premium")).toBe(true);
    expect(isLuxuryTheme("moderna")).toBe(false);
  });
});

describe("googleFontsHref", () => {
  it("incluye las familias del par del tema", () => {
    expect(googleFontsHref({ theme: "moderna" })).toContain("Poppins");
    expect(googleFontsHref({ theme: "moderna" })).toContain("display=swap");
  });

  it("refleja el override de fuente", () => {
    expect(googleFontsHref({ theme: "moderna", font: "playfair-lora" })).toContain(
      "Playfair",
    );
  });
});
