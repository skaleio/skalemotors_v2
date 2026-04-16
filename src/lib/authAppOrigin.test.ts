import { describe, expect, it } from "vitest";
import { passwordRecoveryRedirectUrl, resolvePublicAppOrigin } from "./authAppOrigin";

describe("resolvePublicAppOrigin", () => {
  it("prioriza envUrl override sobre window", () => {
    expect(
      resolvePublicAppOrigin({
        envUrl: "https://prod.example.com/",
        windowOrigin: "http://localhost:5173",
      }),
    ).toBe("https://prod.example.com");
  });

  it("quita barra final del origen por env", () => {
    expect(resolvePublicAppOrigin({ envUrl: "https://app.skale.test/" })).toBe("https://app.skale.test");
  });

  it("usa windowOrigin si no hay env en overrides", () => {
    expect(resolvePublicAppOrigin({ envUrl: "", windowOrigin: "https://staging.example.com" })).toBe(
      "https://staging.example.com",
    );
  });
});

describe("passwordRecoveryRedirectUrl", () => {
  it("añade /reset-password al origen resuelto", () => {
    expect(
      passwordRecoveryRedirectUrl({
        envUrl: "https://app.example.com",
        windowOrigin: "http://localhost:5173",
      }),
    ).toBe("https://app.example.com/reset-password");
  });
});
