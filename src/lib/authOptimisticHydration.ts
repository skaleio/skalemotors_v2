import { isProfileCacheValid, readCachedProfile } from "@/lib/authProfileCache";
import {
  canRefreshPersistedSession,
  isAccessTokenExpired,
  readPersistedAuthSession,
} from "@/lib/authSessionCleanup";
import type { User } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

function envFalsey(name: string): boolean {
  const v = (import.meta.env[name] as string | undefined)?.trim().toLowerCase();
  return v === "false" || v === "0";
}

/** Kill switch: `VITE_AUTH_OPTIMISTIC_BOOTSTRAP=false` revierte al bootstrap bloqueante anterior. */
export function isOptimisticAuthBootstrapEnabled(): boolean {
  return !envFalsey("VITE_AUTH_OPTIMISTIC_BOOTSTRAP");
}

export type OptimisticAuthSnapshot = {
  session: Session;
  profile: User;
};

/**
 * Lectura síncrona de sesión + perfil cacheados. Sin red.
 * Solo devuelve datos si la sesión es recuperable y el perfil pasa validación de tenant/legacy.
 */
export function readOptimisticAuthSnapshot(): OptimisticAuthSnapshot | null {
  if (typeof window === "undefined" || !isOptimisticAuthBootstrapEnabled()) {
    return null;
  }

  const session = readPersistedAuthSession();
  const userId = session?.user?.id;
  if (!session || !userId) return null;

  if (isAccessTokenExpired(session) && !canRefreshPersistedSession(session)) {
    return null;
  }

  const profile = readCachedProfile(userId);
  if (!profile || !isProfileCacheValid(profile) || profile.id !== userId) {
    return null;
  }

  return { session, profile };
}
