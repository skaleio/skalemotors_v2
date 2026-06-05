import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  canRefreshPersistedSession,
  getSupabaseAuthStorageKey,
  isAccessTokenExpired,
  readPersistedAuthSession,
  refreshPersistedSessionIfNeeded,
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

describe("refreshPersistedSessionIfNeeded", () => {
  it("no llama refresh si el access token sigue vigente", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const session = {
      access_token: "a",
      refresh_token: "r",
      expires_at: future,
      user: { id: "u1" },
    } as import("@supabase/supabase-js").Session;
    const refreshSession = vi.fn();
    const result = await refreshPersistedSessionIfNeeded(
      { auth: { refreshSession } },
      session,
    );
    expect(result).toBe(session);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("renueva cuando el access token venció y hay refresh_token", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const oldSession = {
      access_token: "old",
      refresh_token: "r",
      expires_at: past,
      user: { id: "u1" },
    } as import("@supabase/supabase-js").Session;
    const newSession = {
      ...oldSession,
      access_token: "new",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    const refreshSession = vi.fn().mockResolvedValue({ data: { session: newSession }, error: null });
    const result = await refreshPersistedSessionIfNeeded(
      { auth: { refreshSession } },
      oldSession,
    );
    expect(refreshSession).toHaveBeenCalledOnce();
    expect(result?.access_token).toBe("new");
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
