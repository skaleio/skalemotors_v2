import { getAuthTimings, isFastAuthDev } from "@/lib/authTimings";
import type { User } from "@/lib/supabase";

const PROFILE_CACHE_KEY_PREFIX = "skale.user-profile";
/** Sobrevive “solo cookies” en DevTools; útil al debuguear login. */
const DEV_SESSION_BACKUP_KEY = "skale.dev-profile-backup";

export const AUTH_PROFILE_SELECT =
  "id,email,full_name,phone,role,tenant_id,legacy_protected,branch_id,is_active,avatar_url,crm_color,onboarding_completed,created_at,updated_at";

type ProfileCacheEnvelope = { profile: User; cachedAt: number };

function getProfileCacheKey(userId: string) {
  return `${PROFILE_CACHE_KEY_PREFIX}.${userId}`;
}

function envelopeFromRaw(raw: string): User | null {
  const parsed = JSON.parse(raw) as ProfileCacheEnvelope | User;
  if (parsed && typeof parsed === "object" && "cachedAt" in parsed && "profile" in parsed) {
    const env = parsed as ProfileCacheEnvelope;
    if (Date.now() - env.cachedAt > getAuthTimings().profileCacheTtlMs) return null;
    return env.profile;
  }
  return parsed as User;
}

export function isProfileCacheValid(profile: User | null | undefined): boolean {
  return !!(profile?.tenant_id || profile?.legacy_protected);
}

export function readCachedProfile(userId: string): User | null {
  if (typeof window === "undefined") return null;

  try {
    const fromLs = window.localStorage.getItem(getProfileCacheKey(userId));
    if (fromLs) {
      const profile = envelopeFromRaw(fromLs);
      if (profile) return profile;
    }
  } catch {
    /* ignore */
  }

  if (!isFastAuthDev() || typeof sessionStorage === "undefined") return null;

  try {
    const backupRaw = sessionStorage.getItem(DEV_SESSION_BACKUP_KEY);
    if (!backupRaw) return null;
    const backup = JSON.parse(backupRaw) as { userId: string; envelope: ProfileCacheEnvelope };
    if (backup.userId !== userId) return null;
    if (Date.now() - backup.envelope.cachedAt > getAuthTimings().profileCacheTtlMs) return null;
    return backup.envelope.profile;
  } catch {
    return null;
  }
}

export function writeCachedProfile(profile: User) {
  if (typeof window === "undefined") return;
  const envelope: ProfileCacheEnvelope = { profile, cachedAt: Date.now() };
  try {
    window.localStorage.setItem(getProfileCacheKey(profile.id), JSON.stringify(envelope));
  } catch {
    /* ignore */
  }
  if (isFastAuthDev()) {
    try {
      sessionStorage.setItem(
        DEV_SESSION_BACKUP_KEY,
        JSON.stringify({ userId: profile.id, envelope }),
      );
    } catch {
      /* ignore */
    }
  }
}

export function clearProfileCacheForUser(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getProfileCacheKey(userId));
  } catch {
    /* ignore */
  }
  if (isFastAuthDev()) {
    try {
      const raw = sessionStorage.getItem(DEV_SESSION_BACKUP_KEY);
      if (!raw) return;
      const backup = JSON.parse(raw) as { userId?: string };
      if (backup.userId === userId) {
        sessionStorage.removeItem(DEV_SESSION_BACKUP_KEY);
      }
    } catch {
      /* ignore */
    }
  }
}
