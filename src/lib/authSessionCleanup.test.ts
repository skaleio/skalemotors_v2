import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  canRefreshPersistedSession,
  getSupabaseAuthStorageKey,
  isAccessTokenExpired,
  readPersistedAuthSession,
} from "./authSessionCleanup";

describe("getSupabaseAuthStorageKey", () => {
  it("deriva la clave desde la URL de Supabase", () => {
    expect(getSupabaseAuthStorageKey()).toMatch(/^sb-.+-auth-token$/);
  });
});

describe("isAccessTokenExpired", () => {
  it("marca vencido cuando expires_at está en el pasado", () => {
    const past = Math.floor(Date.now() / 1000) - 120;
    expect(isAccessTokenExpired({ expires_at: past })).toBe(true);
  });

  it("no marca vencido si aún queda margen", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(isAccessTokenExpired({ expires_at: future })).toBe(false);
  });
});

describe("canRefreshPersistedSession", () => {
  it("es true si hay refresh_token aunque el access token venció", () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    expect(
      canRefreshPersistedSession({
        refresh_token: "rt",
        expires_at: past,
      }),
    ).toBe(true);
  });

  it("es false sin refresh_token", () => {
    expect(canRefreshPersistedSession({ refresh_token: "" })).toBe(false);
  });
});

describe("readPersistedAuthSession", () => {
  const key = getSupabaseAuthStorageKey();

  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        length: 0,
        key: vi.fn(),
        clear: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parsea sesión plana en storage", () => {
    const session = {
      access_token: "a",
      refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 99,
    };
    vi.mocked(window.localStorage.getItem).mockReturnValue(JSON.stringify(session));
    expect(readPersistedAuthSession()).toEqual(session);
    expect(window.localStorage.getItem).toHaveBeenCalledWith(key);
  });

  it("parsea formato currentSession", () => {
    const session = {
      access_token: "a",
      refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 99,
    };
    vi.mocked(window.localStorage.getItem).mockReturnValue(
      JSON.stringify({ currentSession: session }),
    );
    expect(readPersistedAuthSession()).toEqual(session);
  });
});
