import { describe, expect, it, vi, afterEach } from "vitest";
import { getAuthTimings, isFastAuthDev } from "./authTimings";

describe("isFastAuthDev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("en DEV es true salvo VITE_AUTH_FAST_DEV=false", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_AUTH_FAST_DEV", "");
    expect(isFastAuthDev()).toBe(true);

    vi.stubEnv("VITE_AUTH_FAST_DEV", "false");
    expect(isFastAuthDev()).toBe(false);
  });
});

describe("getAuthTimings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa timeouts cortos en modo fast dev", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_AUTH_FAST_DEV", "true");
    const t = getAuthTimings();
    expect(t.profileFetchTimeoutMs).toBe(5_000);
    expect(t.profileNetworkRetries).toBe(1);
    expect(t.profileCacheTtlMs).toBe(24 * 60 * 60 * 1000);
  });
});
