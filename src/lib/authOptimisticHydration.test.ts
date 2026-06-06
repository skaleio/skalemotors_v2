import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isOptimisticAuthBootstrapEnabled,
  readOptimisticAuthSnapshot,
} from "./authOptimisticHydration";

vi.mock("./authSessionCleanup", () => ({
  readPersistedAuthSession: vi.fn(),
  canRefreshPersistedSession: vi.fn(() => true),
  isAccessTokenExpired: vi.fn(() => false),
}));

vi.mock("./authProfileCache", () => ({
  isProfileCacheValid: vi.fn((p: unknown) => !!(p as { tenant_id?: string })?.tenant_id),
  readCachedProfile: vi.fn(),
}));

import { readPersistedAuthSession } from "./authSessionCleanup";
import { readCachedProfile } from "./authProfileCache";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function mockSession(userId = USER_ID) {
  return {
    access_token: "at",
    refresh_token: "rt",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId },
  };
}

function mockProfile(userId = USER_ID) {
  return {
    id: userId,
    email: "v@test.io",
    full_name: "Vendedor",
    role: "vendedor" as const,
    tenant_id: "22222222-2222-2222-2222-222222222222",
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

describe("readOptimisticAuthSnapshot", () => {
  beforeEach(() => {
    vi.mocked(readPersistedAuthSession).mockReset();
    vi.mocked(readCachedProfile).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("devuelve null si el kill switch está apagado", () => {
    vi.stubEnv("VITE_AUTH_OPTIMISTIC_BOOTSTRAP", "false");
    vi.mocked(readPersistedAuthSession).mockReturnValue(mockSession() as never);

    expect(readOptimisticAuthSnapshot()).toBeNull();
  });

  it("devuelve sesión + perfil cuando ambos son válidos", () => {
    vi.stubEnv("VITE_AUTH_OPTIMISTIC_BOOTSTRAP", "true");
    vi.mocked(readPersistedAuthSession).mockReturnValue(mockSession() as never);
    vi.mocked(readCachedProfile).mockReturnValue(mockProfile() as never);

    const snap = readOptimisticAuthSnapshot();
    expect(snap?.session.user.id).toBe(USER_ID);
    expect(snap?.profile.tenant_id).toBeTruthy();
  });

  it("devuelve null si userId de sesión y cache no coinciden", () => {
    vi.stubEnv("VITE_AUTH_OPTIMISTIC_BOOTSTRAP", "true");
    vi.mocked(readPersistedAuthSession).mockReturnValue(mockSession() as never);
    vi.mocked(readCachedProfile).mockReturnValue(mockProfile("other-user-id") as never);

    expect(readOptimisticAuthSnapshot()).toBeNull();
  });
});

describe("isOptimisticAuthBootstrapEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("activo por defecto", () => {
    vi.stubEnv("VITE_AUTH_OPTIMISTIC_BOOTSTRAP", "");
    expect(isOptimisticAuthBootstrapEnabled()).toBe(true);
  });

  it("false cuando VITE_AUTH_OPTIMISTIC_BOOTSTRAP=false", () => {
    vi.stubEnv("VITE_AUTH_OPTIMISTIC_BOOTSTRAP", "false");
    expect(isOptimisticAuthBootstrapEnabled()).toBe(false);
  });
});
