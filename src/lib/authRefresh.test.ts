import { describe, expect, it, vi } from "vitest";
import { createSingleFlight } from "./authRefresh";

describe("createSingleFlight", () => {
  it("coalescea llamadas concurrentes en una sola ejecución", async () => {
    let resolveFn: (v: string) => void = () => {};
    const underlying = vi.fn(
      () => new Promise<string>((res) => { resolveFn = res; }),
    );
    const sf = createSingleFlight(underlying);

    const p1 = sf();
    const p2 = sf();
    const p3 = sf();

    expect(underlying).toHaveBeenCalledTimes(1);

    resolveFn("ok");
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toBe("ok");
    expect(r2).toBe("ok");
    expect(r3).toBe("ok");
    expect(underlying).toHaveBeenCalledTimes(1);
  });

  it("permite una nueva ejecución después de resolverse", async () => {
    const underlying = vi.fn(() => Promise.resolve("v"));
    const sf = createSingleFlight(underlying);

    await sf();
    await sf();

    expect(underlying).toHaveBeenCalledTimes(2);
  });

  it("limpia el in-flight si la promesa rechaza (no queda pegado)", async () => {
    const underlying = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recuperado");
    const sf = createSingleFlight(underlying);

    await expect(sf()).rejects.toThrow("boom");
    await expect(sf()).resolves.toBe("recuperado");
    expect(underlying).toHaveBeenCalledTimes(2);
  });
});
